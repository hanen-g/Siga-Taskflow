package com.taskflow.backend.dto.reporting;

import java.time.LocalDate;

public record AdminProjectFilterRequest(
        String projectName,
        String managerName,
        String collaboratorName,
        String skillName,
        String statusLabel,
        LocalDate startDateFrom,
        LocalDate startDateTo,
        LocalDate deadlineFrom,
        LocalDate deadlineTo
) {}
