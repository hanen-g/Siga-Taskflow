export interface Notification {
  id?: number;
  message: string;
  projectName?: string;
  taskTitle?: string;
  managerName?: string;
  read?: boolean;
  createdAt?: string;
}
