import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  AdminDashboard,
  AdminProjectAdvancedFilter,
  AdminProjectAdvancedFilterOptions,
  AdminProjectAdvancedFilterResponse,
  ClientDashboard,
  CollaboratorDashboard,
  ProjectManagerDashboard
} from '../models/reporting.model';

@Injectable({ providedIn: 'root' })
export class ReportingService {
  private readonly base = 'http://localhost:8080/api/reporting';

  constructor(private readonly http: HttpClient) {}

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
      if (value?.trim()) {
        params.set(key, value.trim());
      }
    };
    const appendIfNumber = (key: string, value: number | null | undefined) => {
      if (value != null && !Number.isNaN(Number(value))) {
        params.set(key, String(value));
      }
    };
    appendIfValue('projectName', filters.projectName);
    appendIfValue('managerName', filters.managerName);
    appendIfValue('userName', filters.userName ?? filters.collaboratorName);
    appendIfValue('skillName', filters.skillName);
    appendIfNumber('filterPmUserId', filters.filterPmUserId);
    appendIfNumber('filterCollaboratorUserId', filters.filterCollaboratorUserId);
    if (filters.filterCollaboratorMatchTasks === true) {
      params.set('filterCollaboratorMatchTasks', 'true');
    }
    appendIfNumber('filterClientUserId', filters.filterClientUserId);
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

  adminAdvancedFilterOptions(): Observable<AdminProjectAdvancedFilterOptions> {
    return this.http.get<AdminProjectAdvancedFilterOptions>(`${this.base}/admin/advanced-filter/options`);
  }

  client(): Observable<ClientDashboard> {
    return this.http.get<ClientDashboard>(`${this.base}/client`);
  }
}
