import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { AiChatApiRequest, AiChatApiResponse, AiConversationMessage } from '../models/ai-chat.model';
import { Observable } from 'rxjs';

const HISTORY_MAX = 8;

@Injectable({ providedIn: 'root' })
export class AiChatService {
  private readonly base = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}

  chat(request: AiChatApiRequest): Observable<AiChatApiResponse> {
    return this.http.post<AiChatApiResponse>(`${this.base}/ai/chat`, this.withTrimmedHistory(request));
  }

  preloadModel(): Observable<void> {
    return this.http.post<void>(`${this.base}/ai/preload`, {});
  }

  private withTrimmedHistory(request: AiChatApiRequest): AiChatApiRequest {
    return {
      ...request,
      conversationHistory: trimConversationHistory(request.conversationHistory)
    };
  }
}

export function trimConversationHistory(
  history: AiConversationMessage[]
): AiConversationMessage[] {
  if (history.length <= HISTORY_MAX) {
    return history;
  }
  return history.slice(-HISTORY_MAX);
}
