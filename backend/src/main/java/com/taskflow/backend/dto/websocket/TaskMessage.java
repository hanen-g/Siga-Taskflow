package com.taskflow.backend.dto.websocket;

import com.taskflow.backend.dto.task.TaskResponse;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskMessage {
    private String type; // CREATED, UPDATED, DELETED
    private TaskResponse task;
}
