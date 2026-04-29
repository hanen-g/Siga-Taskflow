package com.taskflow.backend.dto.task;

import lombok.Data;

@Data
public class TaskReportRequest {
    private String reason;
    private String details;
}
