import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class AdminService {

  private apiUrl = 'http://localhost:8080/api/admin/ai-dashboard';

  constructor(private http: HttpClient) {}

  analyze(data: string) {
    return this.http.post(this.apiUrl, { prompt: data }, {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}