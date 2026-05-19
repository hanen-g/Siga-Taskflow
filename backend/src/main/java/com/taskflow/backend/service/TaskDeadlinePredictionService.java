package com.taskflow.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskflow.backend.dto.task.TaskDeadlinePredictionRequest;
import com.taskflow.backend.dto.task.TaskDeadlinePredictionResponse;
import com.taskflow.backend.entity.Priority;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.TaskStatus;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.exception.BadRequestException;
import com.taskflow.backend.exception.ResourceNotFoundException;
import com.taskflow.backend.exception.UnauthorizedException;
import com.taskflow.backend.repository.CommentRepository;
import com.taskflow.backend.repository.ProjectRepository;
import com.taskflow.backend.repository.TaskRepository;
import com.taskflow.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TaskDeadlinePredictionService {

    private static final int MAX_HISTORICAL_SAMPLES = 12;
    private static final int PROJECT_DEADLINE_WARNING_WORKING_DAYS = 3;
    private static final DateTimeFormatter DEADLINE_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm");

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final CommentRepository commentRepository;
    private final OllamaService ollamaService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional(readOnly = true)
    public TaskDeadlinePredictionResponse predict(TaskDeadlinePredictionRequest request, User manager) {
        validateRequest(request);

        Project project = projectRepository.findDetailedById(request.getProjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Project", request.getProjectId()));

        if (!project.getManager().getId().equals(manager.getId())) {
            throw new UnauthorizedException("You are not the manager of this project");
        }

        User assignee = userRepository.findByEmail(request.getCollaboratorEmail().trim())
                .orElseThrow(() -> new BadRequestException("Assignee not found"));

        List<Task> assigneeTasks = taskRepository.findByCollaboratorsContaining(assignee);
        LocalDateTime now = LocalDateTime.now();
        AssigneeAnalysis analysis = buildAssigneeAnalysis(assignee, assigneeTasks, now);
        String prompt = buildPrompt(request, project, assignee, analysis, now);

        JsonNode rawResponse;
        try {
            rawResponse = ollamaService.rawGenerateDeadlinePrediction(prompt);
        } catch (RestClientException ex) {
            throw new IllegalStateException(
                    "Deadline prediction is temporarily unavailable. Check that Ollama is running on your machine.");
        }

        if (rawResponse == null || rawResponse.isNull()) {
            throw new IllegalStateException(
                    "Deadline prediction is temporarily unavailable. Check that Ollama is running on your machine.");
        }

        ParsedPrediction parsed = parsePrediction(rawResponse.asText(""));
        if (parsed == null) {
            parsed = fallbackPrediction(request, project, analysis, now);
        }

        LocalDateTime predicted = normalizePredictedDeadline(parsed.predictedDeadline, now);
        int workingDays = parsed.estimatedWorkingDays > 0
                ? parsed.estimatedWorkingDays
                : countWorkingDays(LocalDate.now(), predicted.toLocalDate());
        String explanation = hasText(parsed.explanation)
                ? parsed.explanation.trim()
                : "Suggested based on assignee workload and historical completion pace.";

        boolean closeToProjectDeadline = isCloseToProjectDeadline(predicted, project.getDeadline());

        return new TaskDeadlinePredictionResponse(
                predicted,
                workingDays,
                explanation,
                closeToProjectDeadline
        );
    }

    private void validateRequest(TaskDeadlinePredictionRequest request) {
        if (request == null || request.getProjectId() == null) {
            throw new BadRequestException("Project is required");
        }
        if (!hasText(request.getTitle())) {
            throw new BadRequestException("Task title is required");
        }
        if (!hasText(request.getPriority())) {
            throw new BadRequestException("Priority is required");
        }
        if (!hasText(request.getCollaboratorEmail())) {
            throw new BadRequestException("Assignee is required");
        }
        try {
            Priority.valueOf(request.getPriority().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Invalid priority");
        }
    }

    private AssigneeAnalysis buildAssigneeAnalysis(User assignee, List<Task> tasks, LocalDateTime now) {
        List<Task> done = tasks.stream()
                .filter(t -> t.getStatus() == TaskStatus.DONE)
                .sorted(Comparator.comparing(Task::getId, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(MAX_HISTORICAL_SAMPLES)
                .toList();

        Map<Long, LocalDateTime> minComments = commentDateMap(
                commentRepository.findMinCreatedAtByTaskIdIn(taskIds(done)));
        Map<Long, LocalDateTime> maxComments = commentDateMap(
                commentRepository.findMaxCreatedAtByTaskIdIn(taskIds(done)));

        List<HistoricalSample> historical = new ArrayList<>();
        for (Task task : done) {
            Long id = task.getId();
            if (id == null) {
                continue;
            }
            LocalDateTime start = minComments.get(id);
            LocalDateTime end = maxComments.get(id);
            Integer days = null;
            if (start != null && end != null && !end.isBefore(start)) {
                days = countWorkingDays(start.toLocalDate(), end.toLocalDate());
            }
            historical.add(new HistoricalSample(
                    nz(task.getTitle()),
                    task.getPriority() != null ? task.getPriority().name() : "UNKNOWN",
                    days
            ));
        }

        List<ActiveTaskSummary> active = tasks.stream()
                .filter(t -> t.getStatus() != TaskStatus.DONE)
                .sorted(Comparator.comparing(
                        t -> t.getDeadline() == null ? LocalDateTime.MAX : t.getDeadline()))
                .map(t -> new ActiveTaskSummary(
                        nz(t.getTitle()),
                        t.getStatus() != null ? t.getStatus().name() : "UNKNOWN",
                        t.getPriority() != null ? t.getPriority().name() : "NONE",
                        t.getDeadline()))
                .toList();

        List<OverdueTaskSummary> overdue = tasks.stream()
                .filter(t -> t.getStatus() != TaskStatus.DONE
                        && t.getDeadline() != null
                        && t.getDeadline().isBefore(now))
                .sorted(Comparator.comparing(Task::getDeadline))
                .map(t -> new OverdueTaskSummary(
                        nz(t.getTitle()),
                        t.getDeadline(),
                        (int) ChronoUnit.DAYS.between(t.getDeadline().toLocalDate(), now.toLocalDate())))
                .toList();

        double avgCompletionDays = historical.stream()
                .map(HistoricalSample::workingDays)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .average()
                .orElse(-1);

        long totalAssigned = tasks.size();
        long completedCount = tasks.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();

        return new AssigneeAnalysis(
                userDisplayName(assignee),
                nz(assignee.getEmail()),
                historical,
                avgCompletionDays,
                (int) completedCount,
                (int) totalAssigned,
                active,
                overdue
        );
    }

    private String buildPrompt(
            TaskDeadlinePredictionRequest request,
            Project project,
            User assignee,
            AssigneeAnalysis analysis,
            LocalDateTime now) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are a project management assistant for TaskFlow. Predict a realistic task deadline.\n");
        sb.append("Use only the data below. Prefer working days (Mon-Fri). End of business day is 17:00.\n");
        sb.append("Respond with JSON only, no markdown:\n");
        sb.append("{\"predictedDeadline\":\"yyyy-MM-ddTHH:mm\",\"estimatedWorkingDays\":number,\"explanation\":\"one or two sentences\"}\n\n");

        sb.append("TODAY: ").append(now.toLocalDate()).append('\n');
        sb.append("PROJECT: ").append(nz(project.getName())).append('\n');
        sb.append("PROJECT DEADLINE: ")
                .append(project.getDeadline() != null ? project.getDeadline() : "(none)")
                .append('\n');

        sb.append("\nNEW TASK:\n");
        sb.append("- Title: ").append(request.getTitle().trim()).append('\n');
        sb.append("- Priority: ").append(request.getPriority().trim().toUpperCase(Locale.ROOT)).append('\n');
        if (hasText(request.getDescription())) {
            sb.append("- Description: ").append(request.getDescription().trim()).append('\n');
        }

        sb.append("\nASSIGNEE: ").append(analysis.displayName())
                .append(" (").append(analysis.email()).append(")\n");
        sb.append("Tasks assigned (all time): ").append(analysis.totalAssigned())
                .append(" | Completed: ").append(analysis.completedCount()).append('\n');

        sb.append("\nHISTORICAL COMPLETION (recent done tasks, working days from first to last comment when available):\n");
        if (analysis.historical().isEmpty()) {
            sb.append("(no completed tasks on record — estimate conservatively)\n");
        } else {
            for (HistoricalSample sample : analysis.historical()) {
                sb.append("- \"").append(sample.title()).append("\" | ")
                        .append(sample.priority());
                if (sample.workingDays() != null) {
                    sb.append(" | ").append(sample.workingDays()).append(" working days");
                } else {
                    sb.append(" | duration unknown");
                }
                sb.append('\n');
            }
            if (analysis.avgCompletionDays() >= 0) {
                sb.append("Average tracked completion: ")
                        .append(String.format(Locale.US, "%.1f", analysis.avgCompletionDays()))
                        .append(" working days\n");
            }
        }

        sb.append("\nCURRENT WORKLOAD: ").append(analysis.activeTasks().size()).append(" active task(s)\n");
        if (analysis.activeTasks().isEmpty()) {
            sb.append("(none)\n");
        } else {
            for (ActiveTaskSummary active : analysis.activeTasks()) {
                sb.append("- \"").append(active.title()).append("\" | ")
                        .append(active.status()).append(" | ")
                        .append(active.priority()).append(" | due: ")
                        .append(active.deadline() != null ? active.deadline().toLocalDate() : "none")
                        .append('\n');
            }
        }

        sb.append("\nOVERDUE TASKS: ").append(analysis.overdueTasks().size()).append('\n');
        if (analysis.overdueTasks().isEmpty()) {
            sb.append("(none)\n");
        } else {
            for (OverdueTaskSummary overdue : analysis.overdueTasks()) {
                sb.append("- \"").append(overdue.title()).append("\" | due ")
                        .append(overdue.deadline().toLocalDate())
                        .append(" | ").append(overdue.daysOverdue()).append(" day(s) overdue\n");
            }
        }

        sb.append("\nThe predicted deadline must be on or after today and should not exceed the project deadline unless workload makes that impossible.\n");
        return sb.toString();
    }

    private ParsedPrediction parsePrediction(String raw) {
        try {
            String json = extractJson(raw.trim());
            JsonNode root = objectMapper.readTree(json);
            String deadlineText = textOrNull(root, "predictedDeadline");
            if (!hasText(deadlineText)) {
                return null;
            }
            LocalDateTime deadline = parsePredictedDateTime(deadlineText.trim());
            int workingDays = root.has("estimatedWorkingDays") && root.get("estimatedWorkingDays").isNumber()
                    ? root.get("estimatedWorkingDays").asInt()
                    : 0;
            String explanation = textOrNull(root, "explanation");
            return new ParsedPrediction(deadline, workingDays, explanation);
        } catch (Exception e) {
            return null;
        }
    }

    private ParsedPrediction fallbackPrediction(
            TaskDeadlinePredictionRequest request,
            Project project,
            AssigneeAnalysis analysis,
            LocalDateTime now) {
        int baseDays = 5;
        if (analysis.avgCompletionDays() >= 0) {
            baseDays = Math.max(1, (int) Math.round(analysis.avgCompletionDays()));
        }
        Priority priority = Priority.valueOf(request.getPriority().trim().toUpperCase(Locale.ROOT));
        baseDays = switch (priority) {
            case HIGH -> Math.max(1, baseDays - 1);
            case LOW -> baseDays + 2;
            default -> baseDays;
        };
        baseDays += Math.min(5, analysis.activeTasks().size());
        baseDays += Math.min(3, analysis.overdueTasks().size());

        LocalDate targetDate = addWorkingDays(LocalDate.now(), baseDays);
        if (project.getDeadline() != null && targetDate.isAfter(project.getDeadline())) {
            targetDate = project.getDeadline();
        }
        LocalDateTime deadline = LocalDateTime.of(targetDate, LocalTime.of(17, 0));
        if (deadline.isBefore(now)) {
            deadline = now.plusDays(1).withHour(17).withMinute(0).withSecond(0).withNano(0);
        }
        return new ParsedPrediction(
                deadline,
                countWorkingDays(LocalDate.now(), deadline.toLocalDate()),
                "Estimated from assignee history, active workload, and task priority (AI response unavailable)."
        );
    }

    private LocalDateTime normalizePredictedDeadline(LocalDateTime predicted, LocalDateTime now) {
        LocalDateTime normalized = predicted;
        if (normalized == null) {
            normalized = now.plusDays(3).withHour(17).withMinute(0).withSecond(0).withNano(0);
        }
        if (normalized.isBefore(now)) {
            normalized = addWorkingDays(LocalDate.now(), 1).atTime(17, 0);
        }
        if (normalized.getHour() == 0 && normalized.getMinute() == 0) {
            normalized = normalized.withHour(17);
        }
        return normalized;
    }

    private boolean isCloseToProjectDeadline(LocalDateTime predicted, LocalDate projectDeadline) {
        if (projectDeadline == null || predicted == null) {
            return false;
        }
        LocalDate predictedDate = predicted.toLocalDate();
        if (!predictedDate.isBefore(projectDeadline)) {
            return true;
        }
        int workingDaysUntilProjectEnd = countWorkingDays(predictedDate, projectDeadline);
        return workingDaysUntilProjectEnd <= PROJECT_DEADLINE_WARNING_WORKING_DAYS;
    }

    private static int countWorkingDays(LocalDate start, LocalDate end) {
        if (start == null || end == null) {
            return 0;
        }
        if (end.isBefore(start)) {
            return 0;
        }
        int count = 0;
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            DayOfWeek dow = d.getDayOfWeek();
            if (dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY) {
                count++;
            }
        }
        return Math.max(count, 1);
    }

    private static LocalDate addWorkingDays(LocalDate start, int workingDays) {
        LocalDate date = start;
        int added = 0;
        while (added < workingDays) {
            date = date.plusDays(1);
            DayOfWeek dow = date.getDayOfWeek();
            if (dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY) {
                added++;
            }
        }
        return date;
    }

    private static Map<Long, LocalDateTime> commentDateMap(List<Object[]> rows) {
        Map<Long, LocalDateTime> map = new HashMap<>();
        if (rows == null) {
            return map;
        }
        for (Object[] row : rows) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            long taskId = ((Number) row[0]).longValue();
            LocalDateTime dt = (LocalDateTime) row[1];
            map.put(taskId, dt);
        }
        return map;
    }

    private static List<Long> taskIds(List<Task> tasks) {
        return tasks.stream().map(Task::getId).filter(Objects::nonNull).collect(Collectors.toList());
    }

    private static LocalDateTime parsePredictedDateTime(String text) {
        try {
            return LocalDateTime.parse(text, DEADLINE_FORMAT);
        } catch (Exception ignored) {
            return LocalDateTime.parse(text);
        }
    }

    private static String extractJson(String raw) {
        int i = raw.indexOf('{');
        int j = raw.lastIndexOf('}');
        if (i >= 0 && j > i) {
            return raw.substring(i, j + 1);
        }
        return raw;
    }

    private static String textOrNull(JsonNode root, String field) {
        JsonNode n = root.get(field);
        if (n == null || n.isNull() || !n.isTextual()) {
            return null;
        }
        String v = n.asText();
        return v.isBlank() ? null : v;
    }

    private static boolean hasText(String s) {
        return s != null && !s.trim().isEmpty();
    }

    private static String nz(String s) {
        return s != null ? s : "";
    }

    private static String userDisplayName(User user) {
        if (user == null) {
            return "Unknown";
        }
        String first = nz(user.getFirstName()).trim();
        String last = nz(user.getLastName()).trim();
        String full = (first + " " + last).trim();
        return full.isEmpty() ? nz(user.getEmail()) : full;
    }

    private record HistoricalSample(String title, String priority, Integer workingDays) {}

    private record ActiveTaskSummary(String title, String status, String priority, LocalDateTime deadline) {}

    private record OverdueTaskSummary(String title, LocalDateTime deadline, int daysOverdue) {}

    private record AssigneeAnalysis(
            String displayName,
            String email,
            List<HistoricalSample> historical,
            double avgCompletionDays,
            int completedCount,
            int totalAssigned,
            List<ActiveTaskSummary> activeTasks,
            List<OverdueTaskSummary> overdueTasks
    ) {}

    private record ParsedPrediction(LocalDateTime predictedDeadline, int estimatedWorkingDays, String explanation) {}
}
