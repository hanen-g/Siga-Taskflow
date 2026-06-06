import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, tap } from 'rxjs';
import { Task, TaskStatus } from '../models/task.model';
import type {
  TaskDeadlinePredictionRequest,
  TaskDeadlinePredictionResponse
} from '../models/task-deadline-prediction.model';
import { WebsocketService } from './websocket.service';

export interface TaskStatusUpdatePayload {
  status: TaskStatus;
  holdReason?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly apiUrl = 'http://localhost:8080/api/tasks';
  private readonly refreshSubject = new Subject<void>();
  refresh$ = this.refreshSubject.asObservable();

  constructor(private readonly http: HttpClient, private readonly ws: WebsocketService) {
    this.ws.getTaskUpdates().subscribe(() => this.refreshSubject.next());
  }

  getTasksByProject(projectId: number): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.apiUrl}/project/${projectId}`);
  }

  createTask(task: Task): Observable<Task> {
    return this.http.post<Task>(this.apiUrl, task).pipe(tap(() => this.refreshSubject.next()));
  }

  deleteTask(taskId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${taskId}`).pipe(tap(() => this.refreshSubject.next()));
  }

  updateTask(taskId: number, task: Partial<Task> & { projectId: number }) {
    return this.http.put<Task>(`${this.apiUrl}/${taskId}`, task).pipe(tap(() => this.refreshSubject.next()));
  }

  updateTaskStatus(taskId: number, payload: TaskStatusUpdatePayload) {
    return this.http.patch<Task>(`${this.apiUrl}/${taskId}/status`, payload).pipe(tap(() => this.refreshSubject.next()));
  }

  /** Tasks for global views: server picks list by role (admin / PM / collaborator; clients get []). */
  getTasksForCurrentUser(): Observable<Task[]> {
    return this.http.get<Task[]>(this.apiUrl);
  }

  uploadTaskFile(taskId: number, file: File): Observable<any> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<any>(`http://localhost:8080/api/files/tasks/${taskId}`, form);
  }

  predictDeadline(body: TaskDeadlinePredictionRequest): Observable<TaskDeadlinePredictionResponse> {
    return this.http.post<TaskDeadlinePredictionResponse>(`${this.apiUrl}/predict-deadline`, body);
  }
}
