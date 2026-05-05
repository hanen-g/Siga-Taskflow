package com.taskflow.backend.dto.reporting;

import java.util.List;

public record CollaboratorDashboardResponse(
        long totalAssigned,
        long completed,
        long onHold,
        long overdue,
        ChartSeriesResponse statusDistribution,
        ChartSeriesResponse tasksPerProject,
        double completionRatePercent,
        Double averageCompletionDays,
        long rejectedByPmHeuristicCount,
        long inReviewWaitingCount,
        List<OverdueTaskRow> overdueTasks,
        List<OnHoldTaskRow> onHoldTasks
) {
    public record OverdueTaskRow(String taskTitle, String deadlineIso, String projectName) {
    }

    public record OnHoldTaskRow(String taskTitle, String holdReason, String projectName) {
    }
}
