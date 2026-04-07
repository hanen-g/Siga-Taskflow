import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Notification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly apiUrl = 'http://localhost:8080/api/notifications';

  constructor(private http: HttpClient) {}

  getMyNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.apiUrl}/my`);
  }

  markAllAsRead(): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/read-all`, {});
  }

  clearMyNotifications(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/my`);
  }
}
