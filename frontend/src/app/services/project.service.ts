import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProjectSkillMatchResult } from '../models/skill.model';
import { ProjectStatus } from '../models/project.model';

export interface AssigneeCandidate {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  activeTaskCount: number;
  matchedSkillCount: number;
}

/** Admin client profile / assignment */
export interface ClientProjectRow {
  id: number;
  name: string;
  deadline: string | null;
}

/** Lightweight client account row for admin selection menus. */
export interface ClientOption {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectService {

  private apiUrl = 'http://localhost:8080/api/projects';
  private proposalsUrl = 'http://localhost:8080/api/project-proposals';

  constructor(private http: HttpClient) {}
  
  myProjects(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/my-projects`);
  }

  getAllProjects(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  /** Projects linked to a client (member of non-archived project). Admin only. */
  getProjectsForClient(clientId: number): Observable<ClientProjectRow[]> {
    return this.http.get<ClientProjectRow[]>(`${this.apiUrl}/admin/clients/${clientId}/projects`);
  }

  /** Adds the client user to each project's members set. Admin only. */
  assignClientToProjects(clientId: number, projectIds: number[]): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/admin/clients/${clientId}/projects`, { projectIds });
  }

  /**
   * Replaces the full set of (non-archived) projects this client belongs to. Admin only.
   * Archived projects remain untouched.
   */
  setClientProjects(clientId: number, projectIds: number[]): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/admin/clients/${clientId}/projects`, { projectIds });
  }

  /** Lists the client members currently assigned to a project. Admin only. */
  getProjectClients(projectId: number): Observable<ClientOption[]> {
    return this.http.get<ClientOption[]>(`${this.apiUrl}/${projectId}/clients`);
  }

  /**
   * Replaces the full set of client members on a project (other roles untouched). Admin only.
   */
  setProjectClients(projectId: number, clientIds: number[]): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${projectId}/clients`, { clientIds });
  }

  createProject(project: {
    name: string;
    description?: string;
    startDate?: string;
    deadline?: string;
    manager: { id: number };
    requiredSkills?: Array<{ id: number }>;
    consumedProposalId?: number | null;
  }): Observable<any> {
    return this.http.post<any>(this.apiUrl, project);
  }

  submitProjectProposal(body: { name: string; description?: string; clientContact?: string | null }): Observable<any> {
    return this.http.post<any>(this.proposalsUrl, body);
  }

  listProposals(): Observable<any[]> {
    return this.http.get<any[]>(this.proposalsUrl);
  }

  getProposal(proposalId: number): Observable<any> {
    return this.http.get<any>(`${this.proposalsUrl}/${proposalId}`);
  }

  discardProposal(proposalId: number): Observable<void> {
    return this.http.post<void>(`${this.proposalsUrl}/${proposalId}/discard`, {});
  }

  updateProject(id: number, project: any): Observable<string> {
    // The backend update currently returns a 200 response with a body Angular
    // cannot parse as JSON, so we accept it as plain text.
    return this.http.put(`${this.apiUrl}/${id}`, project, {
      responseType: 'text'
    });
  }

  archiveProject(id: number, archived: boolean): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/archive?archived=${archived}`, {});
  }

  /** Admin-only: set persisted lifecycle status enum */
  setProjectLifecycle(
    id: number,
    body: { status: ProjectStatus }
  ): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/lifecycle`, body);
  }

  /** Lists projects with the given persisted status (admin: all; project manager: only managed). */
  getProjectsByStatus(status: ProjectStatus): Observable<any[]> {
    const params = new HttpParams().set('status', status);
    return this.http.get<any[]>(`${this.apiUrl}/by-status`, { params });
  }

  getProject(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  getAssigneeCandidates(projectId: number, skillIds: number[]): Observable<AssigneeCandidate[]> {
    let params = new HttpParams();
    for (const id of skillIds ?? []) {
      if (id != null) {
        params = params.append('skillIds', String(id));
      }
    }
    return this.http.get<AssigneeCandidate[]>(`${this.apiUrl}/${projectId}/assignee-candidates`, { params });
  }

  /** Admin create-project: managers matching skills + workload order (same rules as task assignee suggestions). */
  getProjectManagerCandidates(skillIds: number[]): Observable<AssigneeCandidate[]> {
    let params = new HttpParams();
    for (const id of skillIds ?? []) {
      if (id != null) {
        params = params.append('skillIds', String(id));
      }
    }
    return this.http.get<AssigneeCandidate[]>(`${this.apiUrl}/admin/project-manager-candidates`, { params });
  }

  getProjectSkillMatches(projectId: number): Observable<ProjectSkillMatchResult> {
    return this.http.get<ProjectSkillMatchResult>(`${this.apiUrl}/${projectId}/skill-matches`);
  }

  setProjectRequiredSkills(projectId: number, skillIds: number[]): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${projectId}/required-skills`, { skillIds });
  }

  /** upload a file; server returns updated project object */
  uploadAttachment(projectId: number, file: File): Observable<any> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<any>('http://localhost:8080/api/files/projects/' + projectId, form);
  }
}
