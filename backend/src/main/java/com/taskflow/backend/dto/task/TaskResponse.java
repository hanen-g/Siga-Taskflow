package com.taskflow.backend.dto.task;

import com.taskflow.backend.entity.Task;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class TaskResponse {

    private Long id;
    private String title;
    private String description;
    private String status;
    private String collaboratorEmail;
    private String projectName;


    public static TaskResponse fromTask(Task task) {
        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getStatus().name(),
                task.getCollaborator() != null ? task.getCollaborator().getEmail() : null,
                task.getProject() != null ? task.getProject().getName() : null

        );
    }
}
