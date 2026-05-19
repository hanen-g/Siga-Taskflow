package com.taskflow.backend.dto.task;

import com.taskflow.backend.entity.TaskReport;
import com.taskflow.backend.entity.User;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class TaskReportResponse {
    private Long id;
    private Long taskId;
    private String taskTitle;
    private Long projectId;
    private String projectName;
    private Long reporterId;
    private String reporterName;
    private String reporterEmail;
    private String reason;
    private String details;
    private boolean resolved;
    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;

    public static TaskReportResponse fromEntity(TaskReport report) {
        var builder = TaskReportResponse.builder()
                .id(report.getId())
                .taskId(report.getTask().getId())
                .taskTitle(report.getTask().getTitle())
                .projectId(report.getTask().getProject().getId())
                .projectName(report.getTask().getProject().getName())
                .reason(report.getReason())
                .details(report.getDetails())
                .resolved(report.isResolved())
                .createdAt(report.getCreatedAt())
                .resolvedAt(report.getResolvedAt());
        User reporter = report.getReporter();
        if (reporter != null) {
            builder.reporterId(reporter.getId())
                    .reporterName(formatUserName(reporter))
                    .reporterEmail(reporter.getEmail());
        } else {
            report.getTask().soleAssignedCollaborator().ifPresent(fallback -> builder
                    .reporterId(fallback.getId())
                    .reporterName(formatUserName(fallback))
                    .reporterEmail(fallback.getEmail()));
        }
        return builder.build();
    }

    private static String formatUserName(User user) {
        String firstName = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String lastName = user.getLastName() == null ? "" : user.getLastName().trim();
        String fullName = (firstName + " " + lastName).trim();
        return fullName.isBlank() ? user.getEmail() : fullName;
    }
}
