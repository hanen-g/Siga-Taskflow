import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private baseUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}
  
getProfile() {
  return this.http.get('http://localhost:8080/api/user/me', { responseType: 'text' });
}

login(email: string, password: string) {
  return this.http.post<{ token: string }>(
    `${this.baseUrl}/auth/login`,
    { email, password }
  );
}

}
