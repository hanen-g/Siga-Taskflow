export interface TaskReport {
  id?: number;
  taskId: number;
  taskTitle?: string;
  projectId?: number;
  projectName?: string;
  reporterId?: number;
  reporterName?: string;
  reporterEmail?: string;
  reason: string;
  details: string;
  resolved?: boolean;
  createdAt?: string;
  resolvedAt?: string;
}

export interface TaskReportRequest {
  reason: string;
  details: string;
}
