import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProjectSkillMatchResult } from '../models/skill.model';

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

  createProject(project: {
    name: string;
    description?: string;
    startDate?: string;
    deadline?: string;
    manager: { id: number };
    requiredSkills?: Array<{ id: number }>;
    /** Existing client user ids to add as project members (portal access). */
    clientIds?: number[];
  }): Observable<any> {
    return this.http.post<any>(this.apiUrl, project);
  }

  submitProjectProposal(body: { name: string; description?: string; deadline?: string | null }): Observable<any> {
    return this.http.post<any>(this.proposalsUrl, body);
  }

  listPendingProposals(): Observable<any[]> {
    return this.http.get<any[]>(this.proposalsUrl);
  }

  /** Proposal history for the current PM or collaborator */
  listMyProposalHistory(): Observable<any[]> {
    return this.http.get<any[]>(`${this.proposalsUrl}/mine`);
  }

  approveProposal(proposalId: number, managerId?: number | null): Observable<any> {
    const body = managerId != null && managerId !== undefined ? { managerId } : {};
    return this.http.post<any>(`${this.proposalsUrl}/${proposalId}/approve`, body);
  }

  discardProposal(proposalId: number): Observable<void> {
    return this.http.post<void>(`${this.proposalsUrl}/${proposalId}/discard`, {});
  }

  updateProject(id: number, project: Record<string, unknown>): Observable<unknown> {
    return this.http.put<unknown>(`${this.apiUrl}/${id}`, project);
  }

  archiveProject(id: number, archived: boolean): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/archive?archived=${archived}`, {});
  }

  /** Admin-only: partial update of archived / paused / delivered */
  setProjectLifecycle(
    id: number,
    body: { archived?: boolean; paused?: boolean; delivered?: boolean }
  ): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/lifecycle`, body);
  }

  getArchivedProjects(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/archived`);
  }

  getProject(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
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
