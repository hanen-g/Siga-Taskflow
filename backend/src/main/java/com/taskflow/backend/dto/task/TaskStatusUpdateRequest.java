package com.taskflow.backend.dto.task;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TaskStatusUpdateRequest {
    private String status;
    private String holdReason;
}
