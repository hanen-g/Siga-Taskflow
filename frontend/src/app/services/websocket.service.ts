import { Injectable, OnDestroy } from '@angular/core';
import { Client, Frame, IMessage } from '@stomp/stompjs';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { Notification } from '../models/notification.model';
import { TaskMessage } from '../models/task-message.model';
import { ProjectMessage } from '../models/project-message.model';
import { ProjectChatMessage } from '../models/project-chat.model';
@Injectable({ providedIn: 'root' })
export class WebsocketService implements OnDestroy {

  // ─── Connection State ────────────────────────────────────────────────────────
  private client: Client | null = null;
  private isConnecting = false;
  private readonly connectionState$ = new BehaviorSubject<boolean>(false);

  // ─── Streams ─────────────────────────────────────────────────────────────────
  private notifications$    = new Subject<Notification>();
  private projectUpdates$   = new Subject<ProjectMessage>();
  private taskUpdates$      = new Subject<TaskMessage>();

  // ─── Project Subscriptions ───────────────────────────────────────────────────
  private readonly projectSubjects             = new Map<number, Subject<TaskMessage>>();
  private readonly pendingProjectSubscriptions = new Set<number>();

  // ─── Task Comments Subscriptions ────────────────────────────────────────────
  private readonly taskCommentSubjects         = new Map<number, Subject<any>>();
  private readonly pendingTaskCommentSubscriptions = new Set<number>();

  // ─── Project Chat Subscriptions ─────────────────────────────────────────────
  private readonly projectChatSubjects = new Map<number, Subject<ProjectChatMessage>>();
  private readonly pendingProjectChatSubscriptions = new Set<number>();

  // ─── Connect ─────────────────────────────────────────────────────────────────

  connect(): void {
    // Guard: already connected or mid-handshake
    if (this.isConnecting || this.client?.connected) {
      return;
    }

    // Get token - if not available, don't attempt connection
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('WebsocketService: No authentication token found — WebSocket connection skipped');
      return;
    }

    // Validate token format (should be JWT with 3 parts)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      console.error('WebsocketService: Invalid token format. Expected JWT with 3 parts, got:', tokenParts.length);
      return;
    }

    try {
      // Try to decode token to check if it's valid
      const payload = JSON.parse(atob(tokenParts[1]));
      console.log('WebsocketService: Token decoded successfully. User:', payload.sub);
    } catch (e) {
      console.error('WebsocketService: Failed to decode token:', e);
      return;
    }

    this.isConnecting = true;

    const userId = this.getUserId();
    console.log('WebsocketService: Attempting WebSocket connection for userId:', userId);

    this.client = new Client({
      brokerURL: 'ws://localhost:8080/ws',

      connectHeaders: {
        Authorization: `Bearer ${token}`
      },

      debug: () => {}, // Disabled — avoids exposing tokens and internal topics in the console

      reconnectDelay: 5000,
      heartbeatIncoming: 0,
      heartbeatOutgoing: 20000
    });

    // ─── On Connect ────────────────────────────────────────────────────────────
    this.client.onConnect = (frame: Frame) => {
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

      // ✅ Re-subscribe to all tracked task comment topics
      this.taskCommentSubjects.forEach((_, taskId) => {
        this._subscribeToTaskCommentsTopic(taskId);
      });

      // ✅ Flush any task comment subscriptions that were requested before connection was ready
      this.pendingTaskCommentSubscriptions.forEach(id => {
        this._subscribeToTaskCommentsTopic(id);
      });
      this.pendingTaskCommentSubscriptions.clear();

      this.projectChatSubjects.forEach((_, projectId) => {
        this._subscribeToProjectChatTopic(projectId);
      });
      this.pendingProjectChatSubscriptions.forEach(id => {
        this._subscribeToProjectChatTopic(id);
      });
      this.pendingProjectChatSubscriptions.clear();
    };

    // ─── On Disconnect ─────────────────────────────────────────────────────────
    this.client.onDisconnect = () => {
      this.connectionState$.next(false);
    };

    // ─── On Error ──────────────────────────────────────────────────────────────
    this.client.onStompError = (frame: Frame) => {
      this.isConnecting = false;
      this.connectionState$.next(false);
      console.error('WebSocket broker error:', frame.headers['message']);
      console.error('Details:', frame.body);
    };

    this.client.onWebSocketError = (event: Event) => {
      this.isConnecting = false;
      this.connectionState$.next(false);
      
      // Non-blocking error: Log but don't block the application
      console.warn('WebSocket connection failed (non-blocking):', event);
      console.warn('Application will continue to work without real-time notifications');
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
    this.taskCommentSubjects.forEach(s => s.complete());
    this.taskCommentSubjects.clear();
    this.pendingTaskCommentSubscriptions.clear();
    this.projectChatSubjects.forEach(s => s.complete());
    this.projectChatSubjects.clear();
    this.pendingProjectChatSubscriptions.clear();

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
    this.client?.subscribe(`/topic/tasks/project/${projectId}`, (msg: IMessage) => {
      try {
        const payload = JSON.parse(msg.body) as TaskMessage;
        this.taskUpdates$.next(payload);
        this.projectSubjects.get(projectId)?.next(payload);
      } catch (e) {
        console.error(`WebsocketService: Failed to parse task message for project ${projectId}`, e);
      }
    });
  }

  private _subscribeToTaskCommentsTopic(taskId: number): void {
    this.client?.subscribe(`/topic/tasks/comments/${taskId}`, (msg) => {
      try {
        const payload = JSON.parse(msg.body) as any;
        this.taskCommentSubjects.get(taskId)?.next(payload);
      } catch (e) {
        console.error(`WebsocketService: Failed to parse comment message for task ${taskId}`, e);
      }
    });
  }

  private _subscribeToProjectChatTopic(projectId: number): void {
    this.client?.subscribe(`/topic/projects/chat/${projectId}`, (msg: IMessage) => {
      try {
        const payload = JSON.parse(msg.body) as ProjectChatMessage;
        this.projectChatSubjects.get(projectId)?.next(payload);
      } catch (e) {
        console.error(`WebsocketService: Failed to parse project chat message for project ${projectId}`, e);
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

  /**
   * Subscribe to comment updates for a specific task.
   * Safe to call before or after connect().
   */
  subscribeToProjectChat(projectId: number): Observable<ProjectChatMessage> {
    let subject = this.projectChatSubjects.get(projectId);
    const isFirstSubscription = !subject;

    if (!subject) {
      subject = new Subject<ProjectChatMessage>();
      this.projectChatSubjects.set(projectId, subject);
    }

    if (this.client?.connected && isFirstSubscription) {
      this._subscribeToProjectChatTopic(projectId);
    } else if (!this.client?.connected) {
      this.pendingProjectChatSubscriptions.add(projectId);
    }

    return subject.asObservable();
  }

  subscribeToTaskComments(taskId: number): Observable<any> {
    let subject = this.taskCommentSubjects.get(taskId);
    const isFirstSubscription = !subject;

    if (!subject) {
      subject = new Subject<any>();
      this.taskCommentSubjects.set(taskId, subject);
    }

    if (this.client?.connected && isFirstSubscription) {
      this._subscribeToTaskCommentsTopic(taskId);
    } else if (!this.client?.connected) {
      this.pendingTaskCommentSubscriptions.add(taskId);
    }

    return subject.asObservable();
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
