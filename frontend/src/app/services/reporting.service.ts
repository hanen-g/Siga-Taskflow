import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  AdminDashboard,
  AdminProjectAdvancedFilter,
  AdminProjectAdvancedFilterResponse,
  ClientDashboard,
  CollaboratorDashboard,
  ProjectManagerDashboard
} from '../models/reporting.model';

@Injectable({ providedIn: 'root' })
export class ReportingService {
  private readonly base = 'http://localhost:8080/api/reporting';

  constructor(private http: HttpClient) {}

  collaborator(): Observable<CollaboratorDashboard> {
    return this.http.get<CollaboratorDashboard>(`${this.base}/collaborator`);
  }

  projectManager(): Observable<ProjectManagerDashboard> {
    return this.http.get<ProjectManagerDashboard>(`${this.base}/project-manager`);
  }

  admin(): Observable<AdminDashboard> {
    return this.http.get<AdminDashboard>(`${this.base}/admin`);
  }

  adminAdvancedFilter(
    filters: AdminProjectAdvancedFilter,
    page: number,
    size: number
  ): Observable<AdminProjectAdvancedFilterResponse> {
    const params = new URLSearchParams();
    const appendIfValue = (key: string, value: string | undefined) => {
      if (value && value.trim()) {
        params.set(key, value.trim());
      }
    };
    appendIfValue('projectName', filters.projectName);
    appendIfValue('managerName', filters.managerName);
    appendIfValue('collaboratorName', filters.collaboratorName);
    appendIfValue('skillName', filters.skillName);
    if (filters.statusLabel) {
      appendIfValue('statusLabel', filters.statusLabel);
    }
    appendIfValue('startDateFrom', filters.startDateFrom);
    appendIfValue('startDateTo', filters.startDateTo);
    appendIfValue('deadlineFrom', filters.deadlineFrom);
    appendIfValue('deadlineTo', filters.deadlineTo);
    params.set('page', String(page));
    params.set('size', String(size));
    return this.http.get<AdminProjectAdvancedFilterResponse>(
      `${this.base}/admin/advanced-filter?${params.toString()}`
    );
  }

  client(): Observable<ClientDashboard> {
    return this.http.get<ClientDashboard>(`${this.base}/client`);
  }
}
