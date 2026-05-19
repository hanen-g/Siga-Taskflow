package com.taskflow.backend.service;

import com.taskflow.backend.entity.Company;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.ProjectStatus;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.TaskStatus;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.repository.ProjectRepository;
import com.taskflow.backend.repository.TaskRepository;
import com.taskflow.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AiPlatformSnapshotService {

    private static final int MAX_PROJECTS = 10;
    private static final int MAX_TASKS = 15;
    private static final int MAX_COLLABORATORS = 10;
    private static final int MAX_CLIENT_ACCOUNTS = 10;
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public String buildSnapshotPayloadText() {
        List<Project> projects = projectRepository.findForAiSnapshotOrderByActivity(
                PageRequest.of(0, MAX_PROJECTS));
        List<Task> tasks = taskRepository.findForAiSnapshotOrderByActivity(
                PageRequest.of(0, MAX_TASKS));
        List<User> collaborators = userRepository.findFirst10ByRoleOrderByIdDesc(UserRole.COLLABORATOR);
        List<User> clientAccounts = userRepository.findFirst10ByRoleOrderByIdDesc(UserRole.CLIENT);
        List<User> projectManagers = userRepository.findFirst10ByRoleOrderByIdDesc(UserRole.PROJECT_MANAGER);

        long totalActiveUsers = userRepository.countActiveUsers();
        long adminCount = userRepository.countActiveByRole(UserRole.ADMIN);
        long pmCount = userRepository.countActiveByRole(UserRole.PROJECT_MANAGER);
        long collaboratorCount = userRepository.countActiveByRole(UserRole.COLLABORATOR);
        long clientCount = userRepository.countActiveByRole(UserRole.CLIENT);

        long totalProjects = projectRepository.count();
        long totalTasks = taskRepository.count();
        long doneCount = taskRepository.countByStatus(TaskStatus.DONE);
        int completionPct = totalTasks <= 0 ? 0 : (int) Math.round(100.0 * doneCount / totalTasks);
        long blockedTasks = taskRepository.countByStatus(TaskStatus.ON_HOLD);

        Map<Long, long[]> collabCounts = loadCollaboratorCounts(collaborators);

        StringBuilder sb = new StringBuilder();
        sb.append("USER ACCOUNTS (active platform logins by role — NOT project names):\n");
        sb.append("Total active users: ").append(totalActiveUsers)
                .append(" | ADMIN: ").append(adminCount)
                .append(" | PROJECT_MANAGER: ").append(pmCount)
                .append(" | COLLABORATOR: ").append(collaboratorCount)
                .append(" | CLIENT: ").append(clientCount)
                .append('\n');
        sb.append("(When asked \"how many users\", use Total active users and breakdown by role above.)\n\n");

        sb.append("CLIENT ACCOUNTS (users with role=CLIENT — external customers, not projects):\n");
        if (clientAccounts.isEmpty()) {
            sb.append("(none)\n");
        } else {
            for (User u : clientAccounts) {
                sb.append(formatClientAccountLine(u)).append('\n');
            }
            if (clientCount > clientAccounts.size()) {
                sb.append("... and ").append(clientCount - clientAccounts.size()).append(" more client account(s)\n");
            }
        }
        sb.append('\n');

        sb.append("PROJECT MANAGERS (users with role=PROJECT_MANAGER, sample ").append(projectManagers.size()).append("):\n");
        for (User u : projectManagers) {
            sb.append(formatUserSummaryLine(u)).append('\n');
        }
        sb.append('\n');

        sb.append("TEAM COLLABORATORS (users with role=COLLABORATOR, sample ").append(collaborators.size()).append("):\n");
        for (User u : collaborators) {
            long[] tc = collabCounts.getOrDefault(u.getId(), new long[]{0, 0});
            sb.append(collaboratorLine(u, tc[0], tc[1])).append('\n');
        }
        sb.append('\n');

        sb.append("PROJECTS (work initiatives — names like SIGA are project names, not client people):\n");
        for (Project p : projects) {
            sb.append(formatProjectLine(p)).append('\n');
        }
        sb.append('\n');

        sb.append("TASKS (").append(tasks.size()).append(" recent):\n");
        for (Task t : tasks) {
            sb.append(formatTaskLine(t)).append('\n');
        }
        sb.append('\n');

        sb.append("STATS:\n");
        sb.append("Total projects: ").append(totalProjects)
                .append(" | Total tasks: ").append(totalTasks)
                .append(" | Task completion rate: ").append(completionPct).append("%")
                .append(" | Blocked/on-hold tasks: ").append(blockedTasks);
        return sb.toString();
    }

    @Transactional(readOnly = true)
    public AiGlobalSnapshot buildGlobalSummary() {
        long totalUsers = userRepository.countActiveUsers();
        long totalProjects = projectRepository.count();
        long totalTasks = taskRepository.count();
        long done = taskRepository.countByStatus(TaskStatus.DONE);
        double overallPct = totalTasks <= 0 ? 0.0 : (100.0 * done / totalTasks);
        long blocked = taskRepository.countByStatus(TaskStatus.ON_HOLD);
        LocalDateTime now = LocalDateTime.now();
        long overdue = taskRepository.countOverdueNotDone(now);
        return new AiGlobalSnapshot(totalUsers, totalProjects, totalTasks,
                overallPct, blocked, overdue);
    }

    private Map<Long, long[]> loadCollaboratorCounts(List<User> collaborators) {
        Map<Long, long[]> out = new HashMap<>();
        if (collaborators.isEmpty()) {
            return out;
        }
        Set<Long> ids = collaborators.stream()
                .map(User::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return out;
        }
        for (Object[] row : taskRepository.aggregateTaskCountsForCollaborators(ids)) {
            if (row == null || row.length < 3 || row[0] == null) {
                continue;
            }
            long uid = ((Number) row[0]).longValue();
            long total = ((Number) row[1]).longValue();
            long completed = ((Number) row[2]).longValue();
            out.put(uid, new long[]{total, completed});
        }
        return out;
    }

    private String formatClientAccountLine(User u) {
        String name = userDisplayName(u);
        String email = nz(u.getEmail());
        Company co = u.getCompany();
        String companyName = co != null ? nz(co.getCompanyName()) : "(no company)";
        String taxId = co != null ? nz(co.getTaxRegistrationNumber()) : "";
        String active = Boolean.FALSE.equals(u.getIsActive()) ? "inactive" : "active";
        return name + " | role=CLIENT | " + active + " | email: " + email
                + " | company: " + companyName
                + (taxId.isBlank() ? "" : " | tax id: " + taxId);
    }

    private String formatUserSummaryLine(User u) {
        String role = u.getRole() != null ? u.getRole().name() : "UNKNOWN";
        return userDisplayName(u) + " | role=" + role + " | email: " + nz(u.getEmail());
    }

    private String formatProjectLine(Project p) {
        List<Task> ts = p.getTasks() != null ? p.getTasks() : List.of();
        long tt = ts.size();
        long done = ts.stream().filter(x -> x.getStatus() == TaskStatus.DONE).count();
        int pct = tt <= 0 ? 0 : (int) Math.round((100.0 * done / tt));
        User mgr = p.getManager();
        String pm = userDisplayName(mgr);
        String deadline = p.getDeadline() != null ? p.getDeadline().toString() : "";
        String status = snapshotProjectStatus(p);
        return nz(p.getName()) + " | project status: " + status + " | " + pct + "% tasks done | deadline: "
                + deadline + " | PM: " + pm;
    }

    private String snapshotProjectStatus(Project p) {
        ProjectStatus s = p.getStatus();
        if (s == ProjectStatus.ARCHIVED) {
            return "ARCHIVED";
        }
        if (s == ProjectStatus.PAUSED) {
            return "PAUSED";
        }
        if (s == ProjectStatus.COMPLETED) {
            return "COMPLETED";
        }
        List<Task> ts = p.getTasks() != null ? p.getTasks() : List.of();
        if (!ts.isEmpty()) {
            long done = ts.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();
            if (done == ts.size()) {
                return "COMPLETED";
            }
        }
        if (s == ProjectStatus.NOT_STARTED) {
            return "NOT_STARTED";
        }
        return "ACTIVE";
    }

    private String formatTaskLine(Task t) {
        Project p = t.getProject();
        String pName = p != null ? nz(p.getName()) : "";
        String assignee = assigneeNames(t);
        String dl = t.getDeadline() != null ? t.getDeadline().toLocalDate().toString() : "";
        String st = t.getStatus() != null ? t.getStatus().name() : "";
        String pr = t.getPriority() != null ? t.getPriority().name() : "";
        return nz(t.getTitle()) + " | " + st + " | " + pr + " | assigned: " + assignee
                + " | deadline: " + dl + " | project: " + pName;
    }

    private String assigneeNames(Task t) {
        if (t.getCollaborators() == null || t.getCollaborators().isEmpty()) {
            return "";
        }
        return t.getCollaborators().stream()
                .filter(Objects::nonNull)
                .map(this::userDisplayName)
                .filter(s -> !s.isBlank())
                .distinct()
                .sorted()
                .collect(Collectors.joining(", "));
    }

    private String collaboratorLine(User u, long assigned, long completed) {
        return userDisplayName(u) + " | " + assigned + " tasks assigned | " + completed + " completed";
    }

    private String userDisplayName(User user) {
        if (user == null) {
            return "";
        }
        String f = trimOrEmpty(user.getFirstName());
        String l = trimOrEmpty(user.getLastName());
        String full = (f + " " + l).trim();
        return full.isEmpty() ? nz(user.getEmail()) : full;
    }

    private String trimOrEmpty(String s) {
        return s == null ? "" : s.trim();
    }

    private static String nz(String s) {
        return s != null ? s : "";
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
