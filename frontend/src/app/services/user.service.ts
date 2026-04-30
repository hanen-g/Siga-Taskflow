import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Skill } from '../models/skill.model';

export type EmployeeRole = 'ALL' | 'PROJECT_MANAGER' | 'COLLABORATOR' | 'CLIENT' | 'ADMIN';
export type CreateUserRole = 'PROJECT_MANAGER' | 'COLLABORATOR' | 'CLIENT' | 'ADMIN';
export type EmployeeStatusFilter = 'active' | 'former';

export interface AdminUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: Exclude<EmployeeRole, 'ALL'> | 'ADMIN';
  profilePicture?: string;
  active: boolean;
  createdAt?: string;
  skills?: Skill[];
}

export interface AdminUserCreatedResponse {
  user: AdminUser;
  emailSent: boolean;
  message: string;
}

export interface ProjectManagerOption {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl = 'http://localhost:8080/api/user';

  constructor(private http: HttpClient) {}

  getProjectManagersForAdmin(): Observable<ProjectManagerOption[]> {
    return this.http.get<ProjectManagerOption[]>(`${this.apiUrl}/admin/project-managers`);
  }

  searchCollaboratorEmails(query: string): Observable<string[]> {
    const params = new HttpParams().set('q', query.trim());
    return this.http.get<string[]>(`${this.apiUrl}/collaborators`, { params });
  }

  getAdminUsers(search: string, role: EmployeeRole, status: EmployeeStatusFilter): Observable<AdminUser[]> {
    const params = new HttpParams()
      .set('search', search.trim())
      .set('role', role)
      .set('status', status);

    return this.http.get<AdminUser[]>(`${this.apiUrl}/admin/users`, { params });
  }

  updateAdminUser(
    id: number,
    payload: { firstName: string; lastName: string; email: string; role: CreateUserRole; skillIds?: number[] }
  ) {
    return this.http.put<AdminUser>(`${this.apiUrl}/admin/users/${id}`, payload);
  }

  updateUserStatus(id: number, active: boolean) {
    return this.http.patch<AdminUser>(`${this.apiUrl}/admin/users/${id}/status`, { active });
  }

  createAdminUser(payload: { firstName: string; lastName: string; email: string; role: CreateUserRole; skillIds?: number[] }) {
    return this.http.post<AdminUserCreatedResponse>(`${this.apiUrl}/admin/users`, payload);
  }
}
