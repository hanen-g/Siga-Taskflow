import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private baseUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}
  
  getBaseUrl(): string {
    return this.baseUrl;
  }
  
login(email: string, password: string) {
  return this.http.post<AuthResponse>(
    `${this.baseUrl}/auth/login`,
    { email, password }
  );
}

signup(data: { firstName: string; lastName: string; email: string; password: string; role: string }) {
  return this.http.post<AuthResponse>(
    `${this.baseUrl}/auth/signup`,
    data
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

  const payload = JSON.parse(atob(token.split('.')[1]));
  return payload.role;
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

export interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  profilePicture?: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  password?: string;
  currentPassword?: string;
  profilePicture?: string;
}

/** Matches backend {@code UploadedFileResponse} for POST /api/files/upload. */
export interface FileUploadResponse {
  fileUrl: string;
}
