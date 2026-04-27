package com.taskflow.backend.dto.websocket;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Notification {
    private Long id;
    private String message;
    private String projectName;
    private String taskTitle;
    private String managerName;
    private boolean read;
    private LocalDateTime createdAt;

    public static Notification fromEntity(com.taskflow.backend.entity.Notification entity) {
        return new Notification(
                entity.getId(),
                entity.getMessage(),
                entity.getProjectName(),
                entity.getTaskTitle(),
                entity.getManagerName(),
                entity.isRead(),
                entity.getCreatedAt()
        );
    }
}
