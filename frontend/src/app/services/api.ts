import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private readonly baseUrl = 'http://localhost:8080/api';

  constructor(private readonly http: HttpClient) {}
  
  getBaseUrl(): string {
    return this.baseUrl;
  }
  
login(email: string, password: string) {
  return this.http.post<AuthResponse>(
    `${this.baseUrl}/auth/login`,
    { email, password }
  );
}

forgotPassword(email: string) {
  return this.http.post<MessageResponse>(
    `${this.baseUrl}/auth/forgot-password`,
    { email }
  );
}

getProfile() {
  return this.http.get<UserProfile>(`${this.baseUrl}/user/me`);
}

updateProfile(data: UpdateProfileRequest) {
  return this.http.put<UserProfile>(`${this.baseUrl}/user/me`, data);
}

uploadFile(file: File): Observable<FileUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  return this.http.post<FileUploadResponse>(`${this.baseUrl}/files/upload`, form);
}

getRole(): string | null {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

/**
 * Role for UI and route guards: prefer JWT `role` claim (aligned with Bearer auth),
 * then fall back to cached `user` if the token is missing or unreadable.
 */
getResolvedRole(): string | null {
  const jwtRole = this.getRole();
  if (jwtRole) {
    return jwtRole;
  }
  const userData = localStorage.getItem('user');
  if (!userData) return null;
  try {
    return JSON.parse(userData)?.role ?? null;
  } catch {
    return null;
  }
}

}

export interface AuthResponse {
  token: string;
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface MessageResponse {
  message: string;
}

export interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  profilePicture?: string;
  /** ISO calendar date `yyyy-MM-dd` from the server when known. */
  createdAt?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  password?: string;
  currentPassword?: string;
  profilePicture?: string;
  phoneNumber?: string;
  address?: string;
}

/** Matches backend {@code UploadedFileResponse} for POST /api/files/upload. */
export interface FileUploadResponse {
  fileUrl: string;
}
