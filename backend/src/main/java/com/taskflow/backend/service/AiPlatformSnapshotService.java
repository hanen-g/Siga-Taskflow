package com.taskflow.backend.service;

import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.TaskStatus;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.repository.ProjectRepository;
import com.taskflow.backend.repository.TaskRepository;
import com.taskflow.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AiPlatformSnapshotService {

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public String buildSnapshotPayloadText() {
        List<Project> projects = projectRepository.findAllDistinctForReporting();
        List<Task> tasks = taskRepository.findAllFetchingProject();
        List<User> users = userRepository.findAll();

        StringBuilder sb = new StringBuilder();
        sb.append("=== GLOBAL STATS ===\n");
        AiGlobalSnapshot g = buildGlobalMetrics(projects, tasks, users);
        sb.append("totalUsers: ").append(g.totalUsers()).append('\n')
                .append("totalProjects: ").append(g.totalProjects()).append('\n')
                .append("totalTasks: ").append(g.totalTasks()).append('\n')
                .append("overallCompletionRatePercent: ").append(round1(g.overallCompletion())).append('\n')
                .append("blockedTasks_ON_HOLD: ").append(g.blockedTasks()).append('\n')
                .append("overdueTasks: ").append(g.overdueTasks()).append('\n')
                .append('\n');

        sb.append("=== PROJECTS ===\n");
        for (Project p : projects) {
            sb.append(formatProjectLine(p)).append('\n');
        }

        sb.append('\n').append("=== TASKS ===\n");
        for (Task t : tasks) {
            sb.append(formatTaskLine(t)).append('\n');
        }

        sb.append('\n').append("=== USERS AND WORKLOAD ===\n");
        Map<Long, List<Task>> byAssignee = new HashMap<>();
        for (Task t : tasks) {
            if (t.getCollaborators() == null) {
                continue;
            }
            for (User u : t.getCollaborators()) {
                if (u != null && u.getId() != null) {
                    byAssignee.computeIfAbsent(u.getId(), k -> new ArrayList<>()).add(t);
                }
            }
        }

        users.sort(Comparator.comparing(User::getId, Comparator.nullsLast(Long::compare)));
        for (User u : users) {
            List<Task> ut = byAssignee.getOrDefault(u.getId(), List.of());
            long done = ut.stream().filter(x -> x.getStatus() == TaskStatus.DONE).count();
            long hold = ut.stream().filter(x -> x.getStatus() == TaskStatus.ON_HOLD).count();
            String name = displayName(u);
            String role = u.getRole() != null ? u.getRole().name() : "";
            sb.append("- ")
                    .append(name)
                    .append(" | role=").append(role)
                    .append(" | assignedTasks=").append(ut.size())
                    .append(" | completed=").append(done)
                    .append(" | onHold=").append(hold)
                    .append('\n');
        }

        return sb.toString();
    }

    @Transactional(readOnly = true)
    public AiGlobalSnapshot buildGlobalSummary() {
        List<Project> projects = projectRepository.findAllDistinctForReporting();
        List<Task> tasks = taskRepository.findAllFetchingProject();
        List<User> users = userRepository.findAll();
        return buildGlobalMetrics(projects, tasks, users);
    }

    private AiGlobalSnapshot buildGlobalMetrics(List<Project> projects, List<Task> tasks, List<User> users) {
        long totalUsers = users.size();
        long totalProjects = projects.size();
        long totalTasks = tasks.size();
        long done = tasks.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();
        double overallPct = totalTasks <= 0 ? 100.0 : (100.0 * done / totalTasks);
        long blocked = tasks.stream().filter(t -> t.getStatus() == TaskStatus.ON_HOLD).count();
        LocalDateTime now = LocalDateTime.now();
        long overdue = tasks.stream()
                .filter(t -> t.getStatus() != TaskStatus.DONE
                        && t.getDeadline() != null
                        && t.getDeadline().isBefore(now))
                .count();
        return new AiGlobalSnapshot(totalUsers, totalProjects, totalTasks,
                overallPct, blocked, overdue);
    }

    private String formatProjectLine(Project p) {
        List<Task> ts = p.getTasks() != null ? p.getTasks() : List.of();
        long tt = ts.size();
        long done = ts.stream().filter(x -> x.getStatus() == TaskStatus.DONE).count();
        int pct = tt <= 0 ? 100 : (int) Math.round((100.0 * done / tt));
        User mgr = p.getManager();
        String pmName = mgr != null ? displayName(mgr) : "";

        List<String> memberNames = p.getMembers() == null ? List.of()
                : p.getMembers().stream()
                .filter(Objects::nonNull)
                .map(this::displayName)
                .filter(s -> !s.isBlank())
                .distinct()
                .sorted()
                .toList();

        String status = deriveProjectUiStatus(p);

        String skillsStr = "";
        if (p.getRequiredSkills() != null) {
            skillsStr = p.getRequiredSkills().stream()
                    .filter(Objects::nonNull)
                    .map(s -> s.getName() != null ? s.getName().trim() : "")
                    .filter(s -> !s.isBlank())
                    .sorted()
                    .collect(Collectors.joining(", "));
        }

        return "- name=" + nz(p.getName())
                + " | statusLabel=" + status
                + " | archived=" + p.isArchived()
                + " | paused=" + p.isPaused()
                + " | delivered=" + p.isDelivered()
                + " | startDate=" + (p.getStartDate() != null ? p.getStartDate().toString() : "")
                + " | deadline=" + (p.getDeadline() != null ? p.getDeadline().toString() : "")
                + " | completionPercent=" + pct
                + " | projectManager=" + pmName
                + " | collaborators=[" + String.join("; ", memberNames) + "]"
                + " | requiredSkills=[" + skillsStr + "]";
    }

    private static String nz(String s) {
        return s != null ? s : "";
    }

    private String formatTaskLine(Task t) {
        Project p = t.getProject();
        String pName = p != null ? nz(p.getName()) : "";

        List<String> assignees;
        if (t.getCollaborators() != null) {
            assignees = t.getCollaborators().stream()
                    .filter(Objects::nonNull)
                    .map(this::displayName)
                    .filter(name -> !name.isBlank())
                    .distinct()
                    .sorted()
                    .toList();
        } else {
            assignees = List.of();
        }

        String hold = nz(t.getHoldReason());
        return "- title=" + nz(t.getTitle())
                + " | status=" + (t.getStatus() != null ? t.getStatus().name() : "")
                + " | priority=" + (t.getPriority() != null ? t.getPriority().name() : "")
                + " | assignees=[" + String.join("; ", assignees) + "]"
                + " | deadline=" + (t.getDeadline() != null ? t.getDeadline().toString() : "")
                + " | holdReason=" + hold
                + " | projectName=" + pName;
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
        String f = trimOrEmpty(user.getFirstName());
        String l = trimOrEmpty(user.getLastName());
        String full = (f + " " + l).trim();
        if (!full.isEmpty()) {
            return full;
        }
        return trimOrEmpty(user.getEmail());
    }

    private String trimOrEmpty(String s) {
        return s == null ? "" : s.trim();
    }

    private static double round1(double x) {
        return Math.round(x * 10.0) / 10.0;
    }

    public record AiGlobalSnapshot(
            long totalUsers,
            long totalProjects,
            long totalTasks,
            double overallCompletion,
            long blockedTasks,
            long overdueTasks
    ) {
    }
}
