package com.taskflow.backend.dto.reporting;

import java.util.List;

public record AdminDashboardResponse(
        long totalUsers,
        long totalProjects,
        long totalTasks,
        double platformCompletionRatePercent,
        long blockedTasks,
        long inactiveAccounts,
        ChartSeriesResponse usersByRole,
        ChartSeriesResponse tasksPerProject,
        ChartSeriesResponse projectManagerTeamCompletionPercent,
        ChartSeriesResponse platformCompletionTrend30Days,
        ChartSeriesResponse platformStatusDistribution,
        List<AdminProjectOverviewRow> projectsOverview,
        List<AdminUserOverviewRow> usersOverview,
        SystemHealthResponse systemHealth,
        List<NamedLongScoreRow> topCollaborators,
        List<NamedLongScoreRow> topProjectManagers
) {
    public record AdminProjectOverviewRow(
            String projectName,
            String managerName,
            long totalTasks,
            int completionRatePercent,
            String deadlineIso,
            String riskLabel
    ) {
    }

    public record AdminUserOverviewRow(
            String name,
            String role,
            long assignedTasks,
            int completionRatePercent,
            String accountStatus
    ) {
    }

    public record SystemHealthResponse(
            long projectsPastDeadline,
            long overdueTasks,
            long onHoldLongBlockers,
            List<NamedCountResponse> rankedHoldReasons
    ) {
    }

    public record NamedLongScoreRow(String name, long score) {
    }
}
