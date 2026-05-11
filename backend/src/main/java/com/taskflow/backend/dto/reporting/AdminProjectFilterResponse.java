package com.taskflow.backend.dto.reporting;

import java.util.List;

public record AdminProjectFilterResponse(
        List<ProjectRow> projects,
        long totalElements,
        int page,
        int size
) {
    public record ProjectRow(
            String projectName,
            String projectManagerName,
            String startDateIso,
            String deadlineIso,
            long totalTasksCount,
            long completedTasksCount,
            long onHoldTasksCount,
            long overdueTasksCount,
            List<String> collaboratorNames,
            List<String> skills,
            String projectStatusLabel
    ) {}
}
