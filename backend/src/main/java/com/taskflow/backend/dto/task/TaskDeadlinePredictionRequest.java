package com.taskflow.backend.dto.task;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TaskDeadlinePredictionRequest {
    private Long projectId;
    private String title;
    private String description;
    private String priority;
    private String collaboratorEmail;
}
