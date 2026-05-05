package com.taskflow.backend.dto.task;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
public class TaskRequest {
    private String title;
    private String description;
    private Long projectId;
    private String collaboratorEmail;
    private List<String> collaboratorEmails;
    private String priority;
    private LocalDateTime deadline;
    /** Subset of the project's required skill ids; omit or null on update to leave skills unchanged. */
    private List<Long> skillIds;
}
