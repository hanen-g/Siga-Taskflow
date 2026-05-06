package com.taskflow.backend.dto.reporting;

import java.util.List;

public record ClientDashboardResponse(
        long projectCount,
        int overallCompletionPercent,
        long atRiskProjectCount,
        ChartSeriesResponse projectProgressPercent,
        ChartSeriesResponse combinedStatusDistribution,
        List<ClientProjectCard> projects,
        List<ClientProjectTimeline> projectTimelines,
        List<ClientActivityItem> recentActivity
) {
    public record ClientTaskSummary(String title, String assigneeNames, String status, String deadlineIso) {
    }

    public record ClientProjectCard(
            Long projectId,
            String projectName,
            int progressPercent,
            long totalTasks,
            long completedTasks,
            String deadlineIso,
            String statusLabel,
            List<ClientTaskSummary> tasks
    ) {
    }

    public record TimelineEntry(String title, String assigneeNames, String status, String deadlineIso) {
    }

    public record ClientProjectTimeline(Long projectId, String projectName, List<TimelineEntry> entries) {
    }

    public record ClientActivityItem(String occurredAtIso, String summary, String kind) {
    }
}
