import { Task } from "./task.model";
import { UploadedFile } from "./uploaded-file.model";
import { Skill } from "./skill.model";
export interface Project {
  id: number;
  name: string;
  description: string;
  /** Planned or actual start (ISO date yyyy-MM-dd). */
  startDate?: string;
  deadline?: string;
  createdAt?: string;
  managerId?: number;
  managerFirstName?: string;
  managerLastName?: string;
  managerEmail?: string;
  /** Members with role CLIENT (from API), display names for project summary. */
  clientNames?: string[];
  /** Linked CLIENT user ids (admin / staffing). */
  clientIds?: number[];
  file?: string;
  archived?: boolean;
  /** Admin-controlled: work paused on this project */
  paused?: boolean;
  /** Admin-controlled: project delivered / closed */
  delivered?: boolean;
  tasks?: Task[];
  files?: UploadedFile[];
  requiredSkills?: Skill[];
}
