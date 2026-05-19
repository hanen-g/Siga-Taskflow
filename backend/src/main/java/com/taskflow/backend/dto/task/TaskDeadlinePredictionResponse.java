package com.taskflow.backend.dto.task;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TaskDeadlinePredictionResponse {
    private LocalDateTime predictedDeadline;
    private int estimatedWorkingDays;
    private String explanation;
    private boolean closeToProjectDeadline;
}
