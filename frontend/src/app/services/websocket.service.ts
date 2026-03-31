import { Injectable, OnDestroy } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { Notification } from '../models/notification.model';
import { TaskMessage } from '../models/task-message.model';
import { ProjectMessage } from '../models/project-message.model';
@Injectable({ providedIn: 'root' })
export class WebsocketService implements OnDestroy {

  // ─── Connection State ────────────────────────────────────────────────────────
  private client: Client | null = null;
  private isConnecting = false;
  private connectionState$ = new BehaviorSubject<boolean>(false);

  // ─── Streams ─────────────────────────────────────────────────────────────────
  private notifications$    = new Subject<Notification>();
  private projectUpdates$   = new Subject<ProjectMessage>();
  private taskUpdates$      = new Subject<TaskMessage>();

  // ─── Project Subscriptions ───────────────────────────────────────────────────
  private projectSubjects             = new Map<number, Subject<TaskMessage>>();
  private pendingProjectSubscriptions = new Set<number>();

  // ─── Connect ─────────────────────────────────────────────────────────────────

  connect(): void {
    // Guard: already connected or mid-handshake
    if (this.isConnecting || this.client?.connected) {
      return;
    }

    this.isConnecting = true;

    const userId = this.getUserId();

    this.client = new Client({
      brokerURL: 'ws://localhost:8080/ws',

      connectHeaders: {
        Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
      },

      debug: () => {}, // Disabled — avoids exposing tokens and internal topics in the console

      reconnectDelay: 5000,
      heartbeatIncoming: 0,
      heartbeatOutgoing: 20000
    });

    // ─── On Connect ────────────────────────────────────────────────────────────
    this.client.onConnect = (frame) => {
      this.isConnecting = false;
      this.connectionState$.next(true);

      // Subscriptions
      this.client?.subscribe('/topic/projects', this.onProjectMessage.bind(this));

      if (userId !== null) {
        this.client?.subscribe(
          `/topic/notifications/user/${userId}`,
          this.onNotification.bind(this)
        );
        this.client?.subscribe(
          `/topic/tasks/user/${userId}`,
          this.onTaskMessage.bind(this)
        );
      } else {
        console.warn('WebsocketService: No userId found — skipping user-specific subscriptions');
      }

      // ✅ Re-subscribe to all tracked project topics (handles reconnections too)
      this.projectSubjects.forEach((_, projectId) => {
        this._subscribeToProjectTopic(projectId);
      });

      // ✅ Flush any subscriptions that were requested before connection was ready
      this.pendingProjectSubscriptions.forEach(id => {
        this._subscribeToProjectTopic(id);
      });
      this.pendingProjectSubscriptions.clear();
    };

    // ─── On Disconnect ─────────────────────────────────────────────────────────
    this.client.onDisconnect = () => {
      this.connectionState$.next(false);
    };

    // ─── On Error ──────────────────────────────────────────────────────────────
    this.client.onStompError = (frame) => {
      this.isConnecting = false;
      this.connectionState$.next(false);
      console.error('WebSocket broker error:', frame.headers['message']);
      console.error('Details:', frame.body);
    };

    this.client.onWebSocketError = (event) => {
      this.isConnecting = false;
      this.connectionState$.next(false);
      console.error('WebSocket error:', event);
    };

    this.client.activate();
  }

  // ─── Disconnect ──────────────────────────────────────────────────────────────

  disconnect(): void {
    this.isConnecting = false;
    this.client?.deactivate();
    this.client = null;
    this.connectionState$.next(false);

    // Complete all subjects to trigger unsubscription in components
    this.notifications$.complete();
    this.projectUpdates$.complete();
    this.taskUpdates$.complete();
    this.projectSubjects.forEach(s => s.complete());
    this.projectSubjects.clear();
    this.pendingProjectSubscriptions.clear();

    // Reinitialize subjects for future reconnections
    this.notifications$  = new Subject<Notification>();
    this.projectUpdates$ = new Subject<ProjectMessage>();
    this.taskUpdates$    = new Subject<TaskMessage>();
  }

  // ─── Angular Lifecycle ───────────────────────────────────────────────────────

  // ✅ Ensures cleanup if the service is ever destroyed (e.g. lazy-loaded modules)
  ngOnDestroy(): void {
    this.disconnect();
    this.connectionState$.complete();
  }

  // ─── Message Handlers ────────────────────────────────────────────────────────

  private onNotification(message: IMessage): void {
    try {
      const payload = JSON.parse(message.body) as Notification;
      this.notifications$.next(payload);
    } catch (e) {
      console.error('WebsocketService: Failed to parse notification', e);
    }
  }

  private onProjectMessage(message: IMessage): void {
    try {
      const payload = JSON.parse(message.body) as ProjectMessage;
      this.projectUpdates$.next(payload);
    } catch (e) {
      console.error('WebsocketService: Failed to parse project message', e);
    }
  }

  private onTaskMessage(message: IMessage): void {
    try {
      const payload = JSON.parse(message.body) as TaskMessage;
      this.taskUpdates$.next(payload);
    } catch (e) {
      console.error('WebsocketService: Failed to parse task message', e);
    }
  }

  // ─── Project Topic Subscription ──────────────────────────────────────────────

  private _subscribeToProjectTopic(projectId: number): void {
    this.client?.subscribe(`/topic/tasks/project/${projectId}`, (msg) => {
      try {
        const payload = JSON.parse(msg.body) as TaskMessage;
        this.taskUpdates$.next(payload);
        this.projectSubjects.get(projectId)?.next(payload);
      } catch (e) {
        console.error(`WebsocketService: Failed to parse task message for project ${projectId}`, e);
      }
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Subscribe to task updates for a specific project.
   * Safe to call before or after connect().
   */
  subscribeToProject(projectId: number): Observable<TaskMessage> {
    let subject = this.projectSubjects.get(projectId);
    if (!subject) {
      subject = new Subject<TaskMessage>();
      this.projectSubjects.set(projectId, subject);
    }

    if (this.client?.connected) {
      // Already connected — subscribe immediately
      this._subscribeToProjectTopic(projectId);
    } else {
      // Not yet connected — queue for when onConnect fires
      this.pendingProjectSubscriptions.add(projectId);
    }

    return subject.asObservable();
  }

  getNotificationStream(): Observable<Notification> {
    return this.notifications$.asObservable();
  }

  getProjectUpdates(): Observable<ProjectMessage> {
    return this.projectUpdates$.asObservable();
  }

  getTaskUpdates(): Observable<TaskMessage> {
    return this.taskUpdates$.asObservable();
  }

  /** Emits true when connected, false when disconnected or on error */
  getConnectionState(): Observable<boolean> {
    return this.connectionState$.asObservable();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private getUserId(): number | null {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user).id ?? null : null;
    } catch {
      console.warn('WebsocketService: Could not parse user from localStorage');
      return null;
    }
  }
}
