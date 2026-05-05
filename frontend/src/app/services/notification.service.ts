import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { Notification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly apiUrl = 'http://localhost:8080/api/notifications';
  private readonly refreshRequested = new Subject<void>();

  /** Emitted when the topbar should reload from GET /my (e.g. after a proposal is submitted). */
  readonly refreshNotifications$ = this.refreshRequested.asObservable();

  constructor(private http: HttpClient) {}

  requestNotificationsRefresh(): void {
    this.refreshRequested.next();
  }

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
