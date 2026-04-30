import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, tap } from 'rxjs';
import { Task, TaskStatus } from '../models/task.model';
import { WebsocketService } from './websocket.service';

export interface TaskStatusUpdatePayload {
  status: TaskStatus;
  holdReason?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  private apiUrl = 'http://localhost:8080/api/tasks';
  private refreshSubject = new Subject<void>();
  refresh$ = this.refreshSubject.asObservable();

  constructor(private http: HttpClient, private ws: WebsocketService) {
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

  getMyTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.apiUrl}/my-tasks`);
  }

  getManagerTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.apiUrl}/manager-tasks`);
  }

  getAllTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.apiUrl}/all`);
  }

  uploadTaskFile(taskId: number, file: File): Observable<any> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<any>(`http://localhost:8080/api/files/tasks/${taskId}`, form);
  }
}
