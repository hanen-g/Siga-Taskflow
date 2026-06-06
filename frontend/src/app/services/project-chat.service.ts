import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProjectChatMessage, ProjectChatUnreadCount } from '../models/project-chat.model';

@Injectable({ providedIn: 'root' })
export class ProjectChatService {
  private readonly baseUrl = 'http://localhost:8080/api/projects';

  constructor(private readonly http: HttpClient) {}

  getMessages(projectId: number): Observable<ProjectChatMessage[]> {
    return this.http.get<ProjectChatMessage[]>(`${this.baseUrl}/${projectId}/messages`);
  }

  getUnreadCount(projectId: number): Observable<ProjectChatUnreadCount> {
    return this.http.get<ProjectChatUnreadCount>(`${this.baseUrl}/${projectId}/messages/unread-count`);
  }

  sendMessage(projectId: number, content: string): Observable<ProjectChatMessage> {
    return this.http.post<ProjectChatMessage>(`${this.baseUrl}/${projectId}/messages`, { content });
  }

  markAsRead(projectId: number): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${projectId}/messages/read`, {});
  }
}
