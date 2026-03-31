import { User } from './user.model';

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE'
}

export interface Task {
  id?: number; 
  title: string;
  description: string;
  status: TaskStatus;
  projectId: number;
  collaboratorEmail?: string;
  collaboratorEmails?: string[];
  collaborators?: User[];
  projectName?: string;

}