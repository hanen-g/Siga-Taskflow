package com.taskflow.backend.dto.reporting;

import java.time.LocalDate;

public record AdminProjectFilterRequest(
        String projectName,
        String managerName,
        String userName,
        String skillName,
        String statusLabel,
        LocalDate startDateFrom,
        LocalDate startDateTo,
        LocalDate deadlineFrom,
        LocalDate deadlineTo,
        Long filterPmUserId,
        Long filterCollaboratorUserId,
        /** When true with {@code filterCollaboratorUserId}, match project members or task assignees. */
        Boolean filterCollaboratorMatchTasks,
        Long filterClientUserId
) {}
