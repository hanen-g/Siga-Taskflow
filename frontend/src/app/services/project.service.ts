import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {

  private apiUrl = 'http://localhost:8080/api/projects';

  constructor(private http: HttpClient) {}
  
  myProjects(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/my-projects`);
  }

  getAllProjects(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  createProject(project: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, project);
  }

  updateProject(id: number, project: any): Observable<string> {
    // The backend update currently returns a 200 response with a body Angular
    // cannot parse as JSON, so we accept it as plain text.
    return this.http.put(`${this.apiUrl}/${id}`, project, {
      responseType: 'text'
    });
  }

  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  archiveProject(id: number, archived: boolean): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/archive?archived=${archived}`, {});
  }

  getArchivedProjects(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/archived`);
  }

  /** upload a file; server returns updated project object */
  uploadAttachment(projectId: number, file: File): Observable<any> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<any>(`${this.apiUrl}/${projectId}/attachment`, form);
  }
}
