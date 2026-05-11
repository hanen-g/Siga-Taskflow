export interface ChartSeries {
  labels: string[];
  values: number[];
}

export interface CollaboratorDashboard {
  totalAssigned: number;
  completed: number;
  onHold: number;
  overdue: number;
  statusDistribution: ChartSeries;
  tasksPerProject: ChartSeries;
  completionRatePercent: number;
  averageCompletionDays: number | null;
  rejectedByPmHeuristicCount: number;
  inReviewWaitingCount: number;
  overdueTasks: { taskTitle: string; deadlineIso: string; projectName: string }[];
  onHoldTasks: { taskTitle: string; holdReason: string; projectName: string }[];
}

export interface ProjectManagerDashboard {
  projectsManaged: number;
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  inReviewAttentionCount: number;
  projectProgressPercent: ChartSeries;
  overallStatusDistribution: ChartSeries;
  collaboratorCompletionCounts: ChartSeries;
  completionTrendLast30Days: ChartSeries;
  projectsTable: {
    projectName: string;
    totalTasks: number;
    completedTasks: number;
    progressPercent: number;
    deadlineIso: string;
    riskLabel: string;
  }[];
  collaboratorPerformance: {
    collaboratorName: string;
    totalAssigned: number;
    completed: number;
    onHold: number;
    rejectedHeuristic: number;
    performanceScore: number;
  }[];
  inReviewAttention: { taskTitle: string; collaboratorNames: string; waitingHoursApprox: number }[];
  onHoldAttention: { taskTitle: string; collaboratorNames: string; holdReason: string }[];
}

export interface AdminDashboard {
  totalUsers: number;
  totalProjects: number;
  totalTasks: number;
  platformCompletionRatePercent: number;
  blockedTasks: number;
  inactiveAccounts: number;
  usersByRole: ChartSeries;
  projectsByStatus: ChartSeries;
  tasksPerProject: ChartSeries;
  projectManagerTeamCompletionPercent: ChartSeries;
  platformCompletionTrend30Days: ChartSeries;
  platformStatusDistribution: ChartSeries;
  projectsOverview: {
    projectName: string;
    managerName: string;
    totalTasks: number;
    completionRatePercent: number;
    deadlineIso: string;
    riskLabel: string;
  }[];
  usersOverview: {
    name: string;
    role: string;
    assignedTasks: number;
    completionRatePercent: number;
    accountStatus: string;
  }[];
  systemHealth: {
    projectsPastDeadline: number;
    overdueTasks: number;
    onHoldLongBlockers: number;
    rankedHoldReasons: { name: string; count: number }[];
  };
  topCollaborators: { name: string; score: number }[];
  topProjectManagers: { name: string; score: number }[];
}

export interface AdminProjectAdvancedFilter {
  projectName?: string;
  managerName?: string;
  collaboratorName?: string;
  skillName?: string;
  statusLabel?: 'ACTIVE' | 'COMPLETED' | '';
  startDateFrom?: string;
  startDateTo?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
}

export interface AdminProjectAdvancedFilterRow {
  projectName: string;
  projectManagerName: string;
  startDateIso: string;
  deadlineIso: string;
  totalTasksCount: number;
  completedTasksCount: number;
  onHoldTasksCount: number;
  overdueTasksCount: number;
  collaboratorNames: string[];
  skills: string[];
  projectStatusLabel: 'ACTIVE' | 'COMPLETED';
}

export interface AdminProjectAdvancedFilterResponse {
  projects: AdminProjectAdvancedFilterRow[];
  totalElements: number;
  page: number;
  size: number;
}

export interface ClientDashboard {
  projectCount: number;
  overallCompletionPercent: number;
  atRiskProjectCount: number;
  projectProgressPercent: ChartSeries;
  combinedStatusDistribution: ChartSeries;
  projects: {
    projectId: number;
    projectName: string;
    progressPercent: number;
    totalTasks: number;
    completedTasks: number;
    deadlineIso: string;
    statusLabel: string;
    tasks: {
      title: string;
      assigneeNames: string;
      status: string;
      deadlineIso: string;
    }[];
  }[];
  projectTimelines: {
    projectId: number;
    projectName: string;
    entries: { title: string; assigneeNames: string; status: string; deadlineIso: string }[];
  }[];
  recentActivity: { occurredAtIso: string; summary: string; kind: string }[];
}
