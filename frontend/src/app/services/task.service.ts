import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, tap } from 'rxjs';
import { Task } from '../models/task.model';
import { WebsocketService } from './websocket.service';

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

  updateTaskStatus(taskId: number, status: string) {
    return this.http.put(`${this.apiUrl}/${taskId}/status?status=${status}`, {}).pipe(tap(() => this.refreshSubject.next()));
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
}
