package com.taskflow.backend.dto.reporting;

import java.util.List;

public record ProjectManagerDashboardResponse(
        long projectsManaged,
        long totalTasks,
        long completedTasks,
        long blockedTasks,
        long inReviewAttentionCount,
        ChartSeriesResponse projectProgressPercent,
        ChartSeriesResponse overallStatusDistribution,
        ChartSeriesResponse collaboratorCompletionCounts,
        ChartSeriesResponse completionTrendLast30Days,
        List<ProjectSummaryRow> projectsTable,
        List<CollaboratorPerformanceRow> collaboratorPerformance,
        List<InReviewAttentionRow> inReviewAttention,
        List<OnHoldAttentionRow> onHoldAttention
) {
    public record ProjectSummaryRow(
            String projectName,
            long totalTasks,
            long completedTasks,
            int progressPercent,
            String deadlineIso,
            String riskLabel
    ) {
    }

    public record CollaboratorPerformanceRow(
            String collaboratorName,
            long totalAssigned,
            long completed,
            long onHold,
            long rejectedHeuristic,
            int performanceScore
    ) {
    }

    public record InReviewAttentionRow(String taskTitle, String collaboratorNames, long waitingHoursApprox) {
    }

    public record OnHoldAttentionRow(String taskTitle, String collaboratorNames, String holdReason) {
    }
}
