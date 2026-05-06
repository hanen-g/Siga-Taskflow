import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  AdminDashboard,
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

  client(): Observable<ClientDashboard> {
    return this.http.get<ClientDashboard>(`${this.base}/client`);
  }
}
