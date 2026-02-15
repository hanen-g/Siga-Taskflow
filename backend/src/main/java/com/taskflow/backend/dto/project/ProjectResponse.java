package com.taskflow.backend.dto.project;

import com.taskflow.backend.dto.task.TaskResponse;
import com.taskflow.backend.entity.Project;
import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.stream.Collectors;

@Getter
@Setter
public class ProjectResponse {

    private Long id;
    private String name;
    private String description;
    private List<TaskResponse> tasks;

    public static ProjectResponse fromProject(Project project) {
        ProjectResponse response = new ProjectResponse();
        response.id = project.getId();
        response.name = project.getName();
        response.description = project.getDescription();

        if (project.getTasks() != null) {
            response.tasks = project.getTasks()
                    .stream()
                    .map(TaskResponse::fromTask)
                    .collect(Collectors.toList());
        }

        return response;
    }
}
