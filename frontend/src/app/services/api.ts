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
