package com.taskflow.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.taskflow.backend.dto.ai.AiChatRequest;
import com.taskflow.backend.dto.ai.AiChatResponse;
import com.taskflow.backend.dto.ai.AiFilterPayload;
import com.taskflow.backend.dto.ai.ChatIntent;
import com.taskflow.backend.dto.ai.ConversationMessageDto;
import com.taskflow.backend.entity.Priority;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.Skill;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.TaskStatus;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.exception.UnauthorizedException;
import com.taskflow.backend.repository.ProjectRepository;
import com.taskflow.backend.repository.TaskRepository;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AiAssistantService {

    private static final String FALLBACK_PARSE =
            "L'assistant IA est temporairement indisponible. Veuillez réessayer.";
    private static final String FALLBACK_CONNECT =
            "L'assistant IA est temporairement indisponible. Vérifiez qu'Ollama est lancé sur votre machine.";

    private final OllamaService ollamaService;
    private final AiPlatformSnapshotService snapshotService;
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;

    private final ObjectMapper objectMapper =
            JsonMapper.builder().addModule(new JavaTimeModule()).build();

    @Transactional(readOnly = true)
    public AiChatResponse chat(User admin, AiChatRequest request) {
        if (admin.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Admin only");
        }

        try {
            return handleChat(admin, request);
        } catch (RestClientException | DataAccessResourceFailureException e) {
            return AiChatResponse.builder()
                    .assistantMessage(FALLBACK_CONNECT)
                    .results(List.of())
                    .resultCount(0)
                    .suggestedFollowUps(List.of())
                    .build();
        } catch (Exception e) {
            return AiChatResponse.builder()
                    .assistantMessage(FALLBACK_PARSE)
                    .results(List.of())
                    .resultCount(0)
                    .suggestedFollowUps(List.of())
                    .build();
        }
    }

    private AiChatResponse handleChat(User admin, AiChatRequest request) throws Exception {
        String platformData = snapshotService.buildSnapshotPayloadText();
        String historyText = formatHistory(truncateHistory(request.getConversationHistory()));
        ChatIntent intent = request.getIntent() != null ? request.getIntent() : ChatIntent.UNKNOWN;

        String prompt = buildMainPrompt(platformData, historyText, request.getMessage(), intent.name());

        JsonNode responseNode = ollamaService.rawGenerate(prompt);
        if (responseNode == null) {
            return parseFailure();
        }
        String rawText = responseNode.asText("");
        ParsedOllama parsed = parseStructuredResponse(rawText);
        if (parsed == null) {
            return parseFailure();
        }

        AiFilterPayload filters = parsed.filters != null ? parsed.filters : new AiFilterPayload();
        List<Map<String, Object>> results = List.of();
        int resultCount = 0;

        if (parsed.actionType != null && "FILTER".equalsIgnoreCase(parsed.actionType) && filters.hasAnyFilter()) {
            ResultBundle bundle = executeFilter(filters);
            results = bundle.results();
            resultCount = results.size();
        }

        List<String> followUps = fetchFollowUps(request.getMessage(), parsed.message);

        String snapshot = parsed.dataSnapshot != null ? parsed.dataSnapshot
                : "Données TaskFlow agrégées (projets, tâches, utilisateurs et statistiques).";

        return AiChatResponse.builder()
                .assistantMessage(parsed.message != null ? parsed.message : "")
                .actionType(parsed.actionType)
                .filters(filters.hasAnyFilter() ? filters : null)
                .results(results)
                .resultCount(resultCount)
                .dataSnapshot(snapshot)
                .suggestion(parsed.suggestion)
                .suggestedFollowUps(followUps)
                .build();
    }

    private AiChatResponse parseFailure() {
        return AiChatResponse.builder()
                .assistantMessage(FALLBACK_PARSE)
                .actionType(null)
                .filters(null)
                .results(List.of())
                .resultCount(0)
                .dataSnapshot(null)
                .suggestion(null)
                .suggestedFollowUps(List.of())
                .build();
    }

    private List<String> fetchFollowUps(String userMessage, String assistantReply) {
        try {
            String sugPrompt = """
                    Respond with ONLY a valid JSON object. No markdown. Keys: ["questions"]. questions must be an array of 2 or 3 short follow-up prompts in the SAME language as the user last message.

                    USER:"""
                    + " " + nz(userMessage) + """

                    ASSISTANT:"""
                    + " " + nz(assistantReply) + """

                    Format: {"questions":["...","..."]}
                    """;

            JsonNode node = ollamaService.rawGenerateFollowUps(sugPrompt);
            if (node == null) {
                return List.of();
            }
            String raw = extractJson(node.asText(""));
            JsonNode tree = objectMapper.readTree(raw);
            if (!tree.has("questions") || !(tree.get("questions") instanceof ArrayNode arr)) {
                return List.of();
            }
            List<String> qs = new ArrayList<>();
            for (JsonNode n : arr) {
                if (!n.isNull() && !n.asText().isBlank()) {
                    qs.add(n.asText().trim());
                    if (qs.size() >= 3) {
                        break;
                    }
                }
            }
            return qs;
        } catch (Exception e) {
            return List.of();
        }
    }

    private ResultBundle executeFilter(AiFilterPayload f) {
        Specification<Project> ps = Specification.where(distinctProjects()).and(buildProjectSpecs(f));

        List<Project> projects = projectRepository.findAll(ps, PageRequest.of(0, 500)).getContent();
        projects = projects.stream().filter(p -> passesCompletionRates(p, f)).toList();

        List<Long> ids = projects.stream().map(Project::getId).filter(Objects::nonNull).toList();
        if (!ids.isEmpty()) {
            Map<Long, Project> full = projectRepository.findDetailedByIdIn(ids).stream()
                    .collect(Collectors.toMap(Project::getId, p -> p));
            projects = ids.stream().map(full::get).filter(Objects::nonNull).toList();
            projects = projects.stream().filter(p -> passesCompletionRates(p, f)).toList();
        }

        boolean taskSignals = filterHasStrongTaskSignals(f);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Project p : projects) {
            rows.add(mapProjectRow(p));
        }

        if (rows.isEmpty() && taskSignals) {
            Specification<Task> ts = Specification.where(distinctTasks()).and(buildTaskSpecs(f));
            List<Task> tasks = taskRepository.findAll(ts, PageRequest.of(0, 400)).getContent();
            for (Task t : tasks) {
                rows.add(mapTaskRow(t));
            }
        }

        return new ResultBundle(rows);
    }

    private boolean filterHasStrongTaskSignals(AiFilterPayload f) {
        return hasTxt(f.getTaskStatus())
                || hasTxt(f.getTaskPriority())
                || Boolean.TRUE.equals(f.getHasOverdueTasks())
                || Boolean.TRUE.equals(f.getHasBlockedTasks());
    }

    private Specification<Project> distinctProjects() {
        return (root, query, cb) -> {
            query.distinct(true);
            return cb.conjunction();
        };
    }

    private Specification<Task> distinctTasks() {
        return (root, query, cb) -> {
            query.distinct(true);
            return cb.conjunction();
        };
    }

    private Specification<Project> buildProjectSpecs(AiFilterPayload filter) {
        Specification<Project> spec = Specification.where((root, query, cb) -> cb.conjunction());

        if (hasTxt(filter.getProjectName())) {
            String term = "%" + filter.getProjectName().trim().toLowerCase(Locale.ROOT) + "%";
            spec = spec.and((root, query, cb) -> cb.like(cb.lower(root.get("name")), term));
        }

        if (hasTxt(filter.getProjectManagerName())) {
            String term = "%" + filter.getProjectManagerName().trim().toLowerCase(Locale.ROOT) + "%";
            spec = spec.and((root, query, cb) -> {
                var mgr = root.join("manager");
                return cb.or(
                        cb.like(cb.lower(cb.coalesce(mgr.get("firstName"), cb.literal(""))), term),
                        cb.like(cb.lower(cb.coalesce(mgr.get("lastName"), cb.literal(""))), term)
                );
            });
        }

        if (hasTxt(filter.getCollaboratorName())) {
            String term = "%" + filter.getCollaboratorName().trim().toLowerCase(Locale.ROOT) + "%";
            spec = spec.and((root, query, cb) -> cb.or(
                    memberMatches(root, query, cb, term),
                    taskAssigneesMatch(root, query, cb, term)
            ));
        }

        if (filter.getSkills() != null) {
            for (String sk : filter.getSkills()) {
                if (!hasTxt(sk)) {
                    continue;
                }
                String sterm = "%" + sk.trim().toLowerCase(Locale.ROOT) + "%";
                spec = spec.and((root, query, cb) -> {
                    Join<Project, Skill> join = root.joinSet("requiredSkills");
                    return cb.like(cb.lower(join.get("name")), sterm);
                });
            }
        }

        LocalDate sFrom = parseLocalDate(filter.getStartDateFrom());
        LocalDate sTo = parseLocalDate(filter.getStartDateTo());
        LocalDate dFrom = parseLocalDate(filter.getDeadlineFrom());
        LocalDate dTo = parseLocalDate(filter.getDeadlineTo());
        if (sFrom != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("startDate"), sFrom));
        }
        if (sTo != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("startDate"), sTo));
        }
        if (dFrom != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("deadline"), dFrom));
        }
        if (dTo != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("deadline"), dTo));
        }

        if (hasTxt(filter.getProjectStatus())) {
            String st = filter.getProjectStatus().trim().toUpperCase(Locale.ROOT);
            spec = switch (st) {
                case "ARCHIVED" -> spec.and((root, query, cb) -> cb.isTrue(root.get("archived")));
                case "PAUSED" -> spec.and((root, query, cb) -> cb.and(
                        cb.isTrue(root.get("paused")),
                        cb.isFalse(root.get("archived"))
                ));
                case "COMPLETED" -> spec.and(projectCompletedPredicate());
                case "ACTIVE" -> spec.and(projectActivePredicate());
                default -> spec;
            };
        }

        if (hasTxt(filter.getTaskStatus())) {
            TaskStatus ts = parseTaskStatus(filter.getTaskStatus());
            if (ts != null) {
                spec = spec.and(taskExistsOnProject(ts, null));
            }
        }
        if (hasTxt(filter.getTaskPriority())) {
            Priority pr = parsePriority(filter.getTaskPriority());
            if (pr != null) {
                spec = spec.and(taskExistsOnProject(null, pr));
            }
        }
        if (Boolean.TRUE.equals(filter.getHasOverdueTasks())) {
            spec = spec.and(overdueTaskExists());
        }
        if (Boolean.TRUE.equals(filter.getHasBlockedTasks())) {
            spec = spec.and(taskExistsOnProject(TaskStatus.ON_HOLD, null));
        }

        return spec;
    }

    private Specification<Task> buildTaskSpecs(AiFilterPayload filter) {
        Specification<Task> spec = Specification.where((root, query, cb) -> cb.conjunction());

        TaskStatus ts = parseTaskStatus(filter.getTaskStatus());
        if (ts != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), ts));
        }
        Priority pr = parsePriority(filter.getTaskPriority());
        if (pr != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("priority"), pr));
        }
        if (Boolean.TRUE.equals(filter.getHasBlockedTasks())) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), TaskStatus.ON_HOLD));
        }
        if (Boolean.TRUE.equals(filter.getHasOverdueTasks())) {
            LocalDateTime now = LocalDateTime.now();
            spec = spec.and((root, query, cb) -> cb.and(
                    cb.notEqual(root.get("status"), TaskStatus.DONE),
                    cb.lessThan(root.get("deadline"), now)
            ));
        }

        if (hasTxt(filter.getCollaboratorName())) {
            String term = "%" + filter.getCollaboratorName().trim().toLowerCase(Locale.ROOT) + "%";
            spec = spec.and((root, query, cb) -> {
                Join<Task, User> u = root.joinSet("collaborators");
                return cb.or(
                        cb.like(cb.lower(cb.coalesce(u.get("firstName"), cb.literal(""))), term),
                        cb.like(cb.lower(cb.coalesce(u.get("lastName"), cb.literal(""))), term)
                );
            });
        }

        if (hasTxt(filter.getProjectName())) {
            String term = "%" + filter.getProjectName().trim().toLowerCase(Locale.ROOT) + "%";
            spec = spec.and((root, query, cb) -> {
                Join<Task, Project> p = root.join("project");
                return cb.like(cb.lower(p.get("name")), term);
            });
        }

        return spec;
    }

    private jakarta.persistence.criteria.Predicate memberMatches(Root<Project> root,
            jakarta.persistence.criteria.CriteriaQuery<?> query,
            jakarta.persistence.criteria.CriteriaBuilder cb, String term) {
        Join<Project, User> m = root.joinSet("members");
        return cb.or(
                cb.like(cb.lower(cb.coalesce(m.get("firstName"), cb.literal(""))), term),
                cb.like(cb.lower(cb.coalesce(m.get("lastName"), cb.literal(""))), term)
        );
    }

    private jakarta.persistence.criteria.Predicate taskAssigneesMatch(Root<Project> root,
            jakarta.persistence.criteria.CriteriaQuery<?> cq,
            jakarta.persistence.criteria.CriteriaBuilder cb, String term) {
        Subquery<Long> sq = cq.subquery(Long.class);
        Root<Task> t = sq.from(Task.class);
        Join<Task, User> u = t.joinSet("collaborators");
        sq.select(t.get("id")).where(cb.and(
                cb.equal(t.get("project"), root),
                cb.or(
                        cb.like(cb.lower(cb.coalesce(u.get("firstName"), cb.literal(""))), term),
                        cb.like(cb.lower(cb.coalesce(u.get("lastName"), cb.literal(""))), term)
                )
        ));
        return cb.exists(sq);
    }

    private Specification<Project> projectCompletedPredicate() {
        return (root, query, cb) -> cb.or(
                cb.isTrue(root.get("delivered")),
                cb.and(hasAnyTask(root, query, cb), cb.not(hasUndoneTask(root, query, cb)))
        );
    }

    private Specification<Project> projectActivePredicate() {
        return (root, query, cb) -> cb.and(
                cb.isFalse(root.get("archived")),
                cb.isFalse(root.get("paused")),
                cb.isFalse(root.get("delivered")),
                cb.or(
                        cb.not(hasAnyTask(root, query, cb)),
                        hasUndoneTask(root, query, cb)
                )
        );
    }

    private jakarta.persistence.criteria.Predicate hasAnyTask(Root<Project> root,
            jakarta.persistence.criteria.CriteriaQuery<?> cq,
            jakarta.persistence.criteria.CriteriaBuilder cb) {
        Subquery<Long> sq = cq.subquery(Long.class);
        Root<Task> t = sq.from(Task.class);
        sq.select(t.get("id")).where(cb.equal(t.get("project"), root));
        return cb.exists(sq);
    }

    private jakarta.persistence.criteria.Predicate hasUndoneTask(Root<Project> root,
            jakarta.persistence.criteria.CriteriaQuery<?> cq,
            jakarta.persistence.criteria.CriteriaBuilder cb) {
        Subquery<Long> sq = cq.subquery(Long.class);
        Root<Task> t = sq.from(Task.class);
        sq.select(t.get("id")).where(
                cb.equal(t.get("project"), root),
                cb.notEqual(t.get("status"), TaskStatus.DONE)
        );
        return cb.exists(sq);
    }

    private Specification<Project> taskExistsOnProject(TaskStatus status, Priority priority) {
        return (root, query, cb) -> {
            Subquery<Long> sq = query.subquery(Long.class);
            Root<Task> t = sq.from(Task.class);
            jakarta.persistence.criteria.Predicate p = cb.equal(t.get("project"), root);
            if (status != null) {
                p = cb.and(p, cb.equal(t.get("status"), status));
            }
            if (priority != null) {
                p = cb.and(p, cb.equal(t.get("priority"), priority));
            }
            sq.select(t.get("id")).where(p);
            return cb.exists(sq);
        };
    }

    private Specification<Project> overdueTaskExists() {
        LocalDateTime now = LocalDateTime.now();
        return (root, query, cb) -> {
            Subquery<Long> sq = query.subquery(Long.class);
            Root<Task> t = sq.from(Task.class);
            sq.select(t.get("id")).where(
                    cb.equal(t.get("project"), root),
                    cb.notEqual(t.get("status"), TaskStatus.DONE),
                    cb.lessThan(t.get("deadline"), now)
            );
            return cb.exists(sq);
        };
    }

    private boolean passesCompletionRates(Project p, AiFilterPayload filter) {
        List<Task> ts = p.getTasks() != null ? p.getTasks() : List.of();
        long total = ts.size();
        long done = ts.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();
        int pct = total <= 0 ? 100 : (int) Math.round((100.0 * done / total));
        Double min = filter.getMinCompletionRate();
        Double max = filter.getMaxCompletionRate();
        if (min != null && pct < min) {
            return false;
        }
        if (max != null && pct > max) {
            return false;
        }
        return true;
    }

    private Map<String, Object> mapProjectRow(Project p) {
        List<Task> ts = p.getTasks() != null ? p.getTasks() : List.of();
        long total = ts.size();
        long done = ts.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();
        int pct = total <= 0 ? 100 : (int) Math.round((100.0 * done / total));
        User mgr = p.getManager();
        String pm = mgr != null ? displayName(mgr) : "";

        List<String> skills = p.getRequiredSkills() == null ? List.of()
                : p.getRequiredSkills().stream()
                .filter(Objects::nonNull)
                .map(s -> s.getName() != null ? s.getName().trim() : "")
                .filter(s -> !s.isBlank())
                .distinct()
                .sorted()
                .toList();

        String status = deriveProjectUiStatus(p);

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("entityType", "PROJECT");
        m.put("projectName", nz(p.getName()));
        m.put("projectManagerName", pm);
        m.put("startDateIso", p.getStartDate() != null ? p.getStartDate().toString() : "");
        m.put("deadlineIso", p.getDeadline() != null ? p.getDeadline().toString() : "");
        m.put("completionRatePercent", pct);
        m.put("statusLabel", status);
        m.put("skills", skills);
        return m;
    }

    private Map<String, Object> mapTaskRow(Task t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("entityType", "TASK");
        m.put("taskTitle", nz(t.getTitle()));
        m.put("taskStatus", t.getStatus() != null ? t.getStatus().name() : "");
        m.put("priority", t.getPriority() != null ? t.getPriority().name() : "");
        m.put("assigneeNames", assigneeNames(t));
        m.put("deadlineIso", t.getDeadline() != null ? t.getDeadline().toString() : "");
        m.put("holdReason", nz(t.getHoldReason()));
        m.put("projectName", t.getProject() != null ? nz(t.getProject().getName()) : "");
        return m;
    }

    private String assigneeNames(Task t) {
        if (t.getCollaborators() == null) {
            return "";
        }
        return t.getCollaborators().stream()
                .filter(Objects::nonNull)
                .map(this::displayName)
                .filter(s -> !s.isBlank())
                .distinct()
                .sorted()
                .collect(Collectors.joining(", "));
    }

    private String deriveProjectUiStatus(Project p) {
        if (p.isArchived()) {
            return "ARCHIVED";
        }
        if (p.isPaused()) {
            return "PAUSED";
        }
        if (p.isDelivered()) {
            return "COMPLETED";
        }
        List<Task> ts = p.getTasks() != null ? p.getTasks() : List.of();
        if (!ts.isEmpty()) {
            long done = ts.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();
            if (done == ts.size()) {
                return "COMPLETED";
            }
        }
        return "ACTIVE";
    }

    private String displayName(User user) {
        if (user == null) {
            return "";
        }
        String f = nz(user.getFirstName()).trim();
        String l = nz(user.getLastName()).trim();
        String full = (f + " " + l).trim();
        return !full.isEmpty() ? full : nz(user.getEmail());
    }

    private String buildMainPrompt(String platformData, String historyText, String newMessage, String intent) {
        return """
                You are an intelligent assistant for a project management platform called TaskFlow used by a company called SIGA. You have access to real and up to date platform data provided below. Your responsibilities are to answer questions about projects, tasks, collaborators and performance, to detect when the admin wants to filter data and extract the filter criteria as JSON, to analyze trends and identify problems proactively, and to give actionable recommendations. Always respond in the same language the admin uses. Always respond with ONLY a valid JSON object using this exact structure with no markdown and no explanation outside the JSON: { "message": "your conversational response here in the same language as the admin", "actionType": "FILTER or ANSWER or ANALYSIS or CLARIFY", "filters": { "projectName": null, "projectManagerName": null, "projectStatus": null, "startDateFrom": null, "startDateTo": null, "deadlineFrom": null, "deadlineTo": null, "collaboratorName": null, "taskStatus": null, "taskPriority": null, "skills": [], "minCompletionRate": null, "maxCompletionRate": null, "hasOverdueTasks": null, "hasBlockedTasks": null }, "dataSnapshot": "a short 1 sentence summary of what data was used to answer", "suggestion": "an optional proactive suggestion or null if not relevant" }. Set filter fields to null if not relevant. REAL PLATFORM DATA: """
                + platformData +
                """

                CONVERSATION HISTORY: """ + historyText +
                """

                INTENT FROM UI CLIENT: """ + intent +
                """

                NEW MESSAGE: """ + nz(newMessage);
    }

    private String formatHistory(List<ConversationMessageDto> slice) {
        if (slice == null || slice.isEmpty()) {
            return "(aucun)";
        }
        StringBuilder sb = new StringBuilder();
        for (ConversationMessageDto m : slice) {
            sb.append('-').append(' ')
                    .append(nz(m.getRole()))
                    .append(": ")
                    .append(nz(m.getContent()).replace('\n', ' '))
                    .append('\n');
        }
        return sb.toString();
    }

    private List<ConversationMessageDto> truncateHistory(List<ConversationMessageDto> full) {
        if (full == null || full.isEmpty()) {
            return List.of();
        }
        int maxMessages = 20;
        int from = Math.max(0, full.size() - maxMessages);
        return new ArrayList<>(full.subList(from, full.size()));
    }

    private ParsedOllama parseStructuredResponse(String rawResponse) {
        try {
            String json = extractJson(rawResponse.trim());
            JsonNode root = objectMapper.readTree(json);
            ParsedOllama parsed = new ParsedOllama();
            parsed.message = textOrNull(root, "message");
            parsed.actionType = normalizeAction(textOrNull(root, "actionType"));
            parsed.dataSnapshot = textOrNull(root, "dataSnapshot");
            parsed.suggestion = nullIfNullLiteral(textOrNull(root, "suggestion"));
            if (root.hasNonNull("filters")) {
                parsed.filters = objectMapper.treeToValue(root.get("filters"), AiFilterPayload.class);
            } else {
                parsed.filters = new AiFilterPayload();
            }
            return parsed;
        } catch (Exception e) {
            return null;
        }
    }

    private static String textOrNull(JsonNode root, String field) {
        JsonNode n = root.get(field);
        if (n == null || n.isNull() || !n.isTextual()) {
            return null;
        }
        String v = n.asText();
        return v.isBlank() ? null : v;
    }

    private static final class ParsedOllama {
        String message;
        String actionType;
        AiFilterPayload filters;
        String dataSnapshot;
        String suggestion;
    }

    private String nullIfNullLiteral(String s) {
        if (s == null || "null".equalsIgnoreCase(s.trim())) {
            return null;
        }
        return s;
    }

    private String normalizeAction(String action) {
        if (action == null) {
            return null;
        }
        return action.trim().toUpperCase(Locale.ROOT);
    }

    private String extractJson(String raw) {
        int i = raw.indexOf('{');
        int j = raw.lastIndexOf('}');
        if (i >= 0 && j > i) {
            return raw.substring(i, j + 1);
        }
        return raw;
    }

    private boolean hasTxt(String s) {
        return s != null && !s.trim().isEmpty();
    }

    private String nz(String s) {
        return s != null ? s : "";
    }

    private LocalDate parseLocalDate(String s) {
        if (!hasTxt(s)) {
            return null;
        }
        try {
            return LocalDate.parse(s.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private TaskStatus parseTaskStatus(String s) {
        if (!hasTxt(s)) {
            return null;
        }
        try {
            return TaskStatus.valueOf(s.trim().toUpperCase(Locale.ROOT));
        } catch (Exception e) {
            return null;
        }
    }

    private Priority parsePriority(String s) {
        if (!hasTxt(s)) {
            return null;
        }
        try {
            return Priority.valueOf(s.trim().toUpperCase(Locale.ROOT));
        } catch (Exception e) {
            return null;
        }
    }

    private record ResultBundle(List<Map<String, Object>> results) {
    }
}
