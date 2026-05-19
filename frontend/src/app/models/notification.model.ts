/** Derived at read time from notification FKs (matches backend {@code Notification.kind}). */
export type NotificationKind =
  | 'TASK_ASSIGNED'
  | 'PROJECT_ASSIGNED'
  | 'PROPOSAL_SUBMITTED'
  | 'PROJECT_MESSAGE'
  | 'UNKNOWN';

export interface Notification {
  id?: number;
  message: string;
  kind?: NotificationKind;
  read?: boolean;
  createdAt?: string;
  projectId?: number;
  taskId?: number;
}
