import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private baseUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}
  
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
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  password?: string;
  currentPassword?: string;
}
