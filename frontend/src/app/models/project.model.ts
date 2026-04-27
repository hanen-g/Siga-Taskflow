import { Task } from "./task.model";
import { UploadedFile } from "./uploaded-file.model";
import { Skill } from "./skill.model";
export interface Project {
  id: number;
  name: string;
  description: string;
  deadline?: string;
  createdAt?: string;
  managerId?: number;
  managerFirstName?: string;
  managerLastName?: string;
  managerEmail?: string;
  file?: string;
  archived?: boolean;
  tasks?: Task[];
  files?: UploadedFile[];
  requiredSkills?: Skill[];
}
