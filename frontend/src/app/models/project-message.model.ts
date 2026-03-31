import { Project } from './project.model';

export interface ProjectMessage {
  type: 'CREATED' | 'UPDATED' | 'DELETED';
  project: Project;
}
