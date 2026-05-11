import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Skill } from '../models/skill.model';

export type EmployeeRole = 'ALL' | 'PROJECT_MANAGER' | 'COLLABORATOR' | 'CLIENT' | 'ADMIN';
export type CreateUserRole = 'PROJECT_MANAGER' | 'COLLABORATOR' | 'CLIENT' | 'ADMIN';
export type EmployeeStatusFilter = 'active' | 'former';

/**
 * Admin list/detail row from GET/PUT `/admin/users` — matches persisted `users` columns plus,
 * when `role === 'CLIENT'`, contact fields loaded from the linked `clients` row (not `users` columns).
 */
export interface AdminUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: Exclude<EmployeeRole, 'ALL'> | 'ADMIN';
  profilePicture?: string;
  active: boolean;
  dateOfBirth?: string | null;
  gender?: string | null;
  recruitmentDate?: string | null;
  createdAt?: string;
  skills?: Skill[];
  /** `clients.phone_number` — only for CLIENT */
  phoneNumber?: string | null;
  /** `clients.address` */
  address?: string | null;
  /** `clients.company_name` */
  company?: string | null;
  /** `clients.fiscal_matricule` */
  fiscalMatricule?: string | null;
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
  /** Non-archived skills on this PM; used to filter managers vs required project skills. */
  skillIds?: number[];
}

export interface ClientAccountOption {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  /** Optional company name from the linked client profile. */
  company: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl = 'http://localhost:8080/api/user';

  constructor(private http: HttpClient) {}

  getProjectManagersForAdmin(): Observable<ProjectManagerOption[]> {
    return this.http.get<ProjectManagerOption[]>(`${this.apiUrl}/admin/project-managers`);
  }

  /** Active client accounts for admin project assignment dropdowns. */
  getClientsForAdmin(): Observable<ClientAccountOption[]> {
    return this.http.get<ClientAccountOption[]>(`${this.apiUrl}/admin/clients`);
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
    payload: {
      firstName: string;
      lastName: string;
      email: string;
      role: CreateUserRole;
      skillIds?: number[];
      phoneNumber?: string;
      address?: string;
      /** ISO yyyy-MM-dd */
      dateOfBirth?: string;
      gender?: string;
      recruitmentDate?: string;
      company?: string;
      fiscalMatricule?: string;
    }
  ) {
    return this.http.put<AdminUser>(`${this.apiUrl}/admin/users/${id}`, payload);
  }

  updateUserStatus(id: number, active: boolean) {
    return this.http.patch<AdminUser>(`${this.apiUrl}/admin/users/${id}/status`, { active });
  }

  createAdminUser(payload: {
    firstName: string;
    lastName: string;
    email: string;
    role: CreateUserRole;
    skillIds?: number[];
    phoneNumber?: string;
    address?: string;
    /** ISO yyyy-MM-dd */
    dateOfBirth?: string;
    active?: boolean;
    gender?: string;
    /** ISO yyyy-MM-dd — date de recrutement / mise en relation */
    recruitmentDate?: string;
    company?: string;
    fiscalMatricule?: string;
  }) {
    return this.http.post<AdminUserCreatedResponse>(`${this.apiUrl}/admin/users`, payload);
  }
}
