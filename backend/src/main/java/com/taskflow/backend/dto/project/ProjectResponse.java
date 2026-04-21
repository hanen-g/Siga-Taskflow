package com.taskflow.backend.dto.project;

import com.taskflow.backend.dto.task.TaskResponse;
import com.taskflow.backend.dto.file.UploadedFileResponse;
import com.taskflow.backend.entity.Project;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.function.Predicate;
import java.util.stream.Collectors;

@Getter
@Setter
public class ProjectResponse {

    private Long id;
    private String name;
    private String description;
    private LocalDate deadline;
    private String file;
    private boolean archived;
    private LocalDateTime createdAt;
    private Long managerId;
    private String managerFirstName;
    private String managerLastName;
    private String managerEmail;
    private List<TaskResponse> tasks;
    private List<UploadedFileResponse> files;

    public static ProjectResponse fromProject(Project project) {
        return fromProject(project, task -> true);
    }

    public static ProjectResponse fromProject(Project project, Predicate<com.taskflow.backend.entity.Task> taskFilter) {
        ProjectResponse response = new ProjectResponse();
        response.id = project.getId();
        response.name = project.getName();
        response.description = project.getDescription();
        response.deadline = project.getDeadline();
        response.archived = project.isArchived();
        response.createdAt = project.getCreatedAt();
        if (project.getManager() != null) {
            response.managerId = project.getManager().getId();
            response.managerFirstName = project.getManager().getFirstName();
            response.managerLastName = project.getManager().getLastName();
            response.managerEmail = project.getManager().getEmail();
        }

        if (project.getTasks() != null) {
            response.tasks = project.getTasks()
                    .stream()
                    .filter(taskFilter)
                    .map(TaskResponse::fromTask)
                    .collect(Collectors.toList());
        }

        return response;
    }
}
