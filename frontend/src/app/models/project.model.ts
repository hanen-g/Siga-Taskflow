import { Task } from "./task.model";
import { UploadedFile } from "./uploaded-file.model";
import { Skill } from "./skill.model";

export type ProjectStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'ARCHIVED' | 'COMPLETED';

export interface ProjectClient {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
}

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
  file?: string;
  status?: ProjectStatus;
  archived?: boolean;
  /** Admin-controlled: work paused on this project */
  paused?: boolean;
  /** Admin-controlled: project delivered / closed */
  delivered?: boolean;
  /** True when the project has tasks and every task is DONE. */
  readyForDelivery?: boolean;
  /**
   * Numeric lifecycle code:
   * 0 proposed, 1 not started, 2 in progress, 3 archived, 4 delivered, 5 paused.
   */
  projectStatus?: number;
  tasks?: Task[];
  files?: UploadedFile[];
  requiredSkills?: Skill[];
  /** When set by API: first assigned client's label color (admin cards). */
  clientLabelColor?: string | null;
}
