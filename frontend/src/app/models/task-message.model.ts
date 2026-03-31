import { Task } from './task.model';

export interface TaskMessage {
  type: 'CREATED' | 'UPDATED' | 'DELETED';
  task: Task;
}
