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

/** Matches backend `ProjectStatus` names, plus `ACTIVE` (not completed) and '' for any. */
export type AdminProjectAdvancedFilterStatus =
  | ''
  | 'ACTIVE'
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'ARCHIVED'
  | 'COMPLETED';

export interface AdminProjectAdvancedFilter {
  projectName?: string;
  managerName?: string;
  userName?: string;
  collaboratorName?: string;
  skillName?: string;
  statusLabel?: AdminProjectAdvancedFilterStatus;
  startDateFrom?: string;
  startDateTo?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  /** When set, project manager must be this user (id). */
  filterPmUserId?: number;
  filterCollaboratorUserId?: number;
  /**
   * When true with `filterCollaboratorUserId`, include projects where the user is on a task’s
   * collaborator list (as well as project members). When false/omitted: members only.
   */
  filterCollaboratorMatchTasks?: boolean;
  filterClientUserId?: number;
}

export interface AdminFilterRoleUserOption {
  id: number;
  label: string;
}

export interface AdminProjectAdvancedFilterOptions {
  projectNames: string[];
  managerNames: string[];
  userNames: string[];
  skillNames: string[];
  projectManagerUsers: AdminFilterRoleUserOption[];
  collaboratorUsers: AdminFilterRoleUserOption[];
  clientUsers: AdminFilterRoleUserOption[];
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
  /** Persisted `ProjectStatus` enum name from the API (e.g. IN_PROGRESS). */
  projectStatusLabel: string;
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
