import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { AiChatApiRequest, AiChatApiResponse } from '../models/ai-chat.model';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AiChatService {
  private readonly base = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}

  chat(request: AiChatApiRequest): Observable<AiChatApiResponse> {
    return this.http.post<AiChatApiResponse>(`${this.base}/ai/chat`, request);
  }
}
