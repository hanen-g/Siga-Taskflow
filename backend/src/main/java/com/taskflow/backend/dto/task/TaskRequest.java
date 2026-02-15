package com.taskflow.backend.dto.task;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TaskRequest {
    private String title;
    private String description;
    private Long projectId;
    private String collaboratorEmail;

}
