import { Task } from "./task.model";
export interface Project {
  id: number;
  name: string;
  description: string;
  createdAt?: string;
  file?: string;
  archived?: boolean;
  tasks?: Task[];
}
