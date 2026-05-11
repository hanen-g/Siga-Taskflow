package com.taskflow.backend.dto.project;

import com.taskflow.backend.dto.task.TaskResponse;
import com.taskflow.backend.dto.file.UploadedFileResponse;
import com.taskflow.backend.dto.skill.SkillResponse;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.TaskStatus;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.function.Predicate;
import java.util.stream.Collectors;

@Getter
@Setter
public class ProjectResponse {

    private Long id;
    private String name;
    private String description;
    private LocalDate startDate;
    private LocalDate deadline;
    private String file;
    private boolean archived;
    private boolean paused;
    private boolean delivered;
    private boolean readyForDelivery;
    /**
     * Numeric lifecycle code used by the frontend for stable status colors.
     * 0 = proposed (reserved for proposal objects),
     * 1 = not started,
     * 2 = in progress,
     * 3 = archived,
     * 4 = delivered,
     * 5 = paused.
     */
    private int projectStatus;
    private LocalDateTime createdAt;
    private Long managerId;
    private String managerFirstName;
    private String managerLastName;
    private String managerEmail;
    private List<TaskResponse> tasks;
    private List<UploadedFileResponse> files;
    private List<SkillResponse> requiredSkills;

    public static ProjectResponse fromProject(Project project) {
        return fromProject(project, task -> true);
    }

    public static ProjectResponse fromProject(Project project, Predicate<com.taskflow.backend.entity.Task> taskFilter) {
        ProjectResponse response = new ProjectResponse();
        response.id = project.getId();
        response.name = project.getName();
        response.description = project.getDescription();
        response.startDate = project.getStartDate();
        response.deadline = project.getDeadline();
        response.archived = project.isArchived();
        response.setPaused(project.isPaused());
        response.setDelivered(project.isDelivered());
        response.setReadyForDelivery(isReadyForDelivery(project));
        response.setProjectStatus(resolveProjectStatusCode(project));
        response.createdAt = project.getCreatedAt();
        if (project.getManager() != null) {
            response.managerId = project.getManager().getId();
            response.managerFirstName = project.getManager().getFirstName();
            response.managerLastName = project.getManager().getLastName();
            response.managerEmail = project.getManager().getEmail();
        }

        if (project.getTasks() != null) {
            // findDetailedById join-fetches tasks + collaborators + skills; SQL can repeat the same
            // task row, which Hibernate may reflect as duplicate Task references in the list.
            HashSet<Long> seenTaskIds = new HashSet<>();
            response.tasks = project.getTasks()
                    .stream()
                    .filter(Objects::nonNull)
                    .filter(taskFilter)
                    .filter(t -> t.getId() != null && seenTaskIds.add(t.getId()))
                    .map(TaskResponse::fromTask)
                    .collect(Collectors.toList());
        }

        if (project.getRequiredSkills() != null) {
            response.requiredSkills = project.getRequiredSkills()
                    .stream()
                    .filter(sk -> !sk.isArchived())
                    .map(SkillResponse::fromEntity)
                    .sorted(Comparator.comparing(SkillResponse::getName, Comparator.nullsLast(String::compareToIgnoreCase)))
                    .collect(Collectors.toList());
        }

        return response;
    }

    private static boolean isReadyForDelivery(Project project) {
        if (project.getTasks() == null || project.getTasks().isEmpty()) {
            return false;
        }
        return project.getTasks().stream()
                .allMatch(task -> task != null && task.getStatus() == TaskStatus.DONE);
    }

    private static int resolveProjectStatusCode(Project project) {
        if (project.isArchived()) {
            return 3;
        }
        if (project.isDelivered()) {
            return 4;
        }
        if (project.isPaused()) {
            return 5;
        }
        LocalDate start = project.getStartDate();
        if (start != null && start.isAfter(LocalDate.now())) {
            return 1;
        }
        return 2;
    }

    /**
     * Client portal: progress-oriented payload without internal staffing or required-skills data.
     */
    public static ProjectResponse fromProjectForClient(Project project) {
        ProjectResponse response = fromProject(project);
        if (project.getTasks() != null) {
            response.setTasks(project.getTasks().stream()
                    .map(TaskResponse::fromTaskForClient)
                    .collect(Collectors.toList()));
        }
        response.setRequiredSkills(List.of());
        if (response.getManagerEmail() != null) {
            response.setManagerEmail(null);
        }
        return response;
    }
}
