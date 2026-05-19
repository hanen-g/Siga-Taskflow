package com.taskflow.backend.dto.websocket;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * API / WebSocket payload. {@code kind} is derived at read time from which FKs are set (not persisted).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Notification {
    private Long id;
    private String message;
    /** Derived: {@code PROPOSAL_SUBMITTED}, {@code TASK_ASSIGNED}, {@code PROJECT_ASSIGNED}, {@code PROJECT_MESSAGE}, or {@code UNKNOWN}. */
    private String kind;
    private boolean read;
    private LocalDateTime createdAt;
    private Long projectId;
    private Long taskId;
}
