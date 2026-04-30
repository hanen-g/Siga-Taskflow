import { User } from './user.model';

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE'
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export interface Task {
  id?: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority?: Priority;
  deadline?: string;
  projectId: number;
  collaboratorEmail?: string;
  collaboratorEmails?: string[];
  collaborators?: User[];
  projectName?: string;
  holdReason?: string | null;
}