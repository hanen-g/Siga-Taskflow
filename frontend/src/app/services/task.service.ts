import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Task } from '../pages/project_manager/projects/models/task.model';
import { Observable } from 'rxjs';


@Injectable({ providedIn: 'root' })
export class TaskService {

  private apiUrl = 'http://localhost:8080/api/tasks';

  constructor(private http: HttpClient) {}

  getTasksByProject(projectId: number) {
    return this.http.get<any[]>(`${this.apiUrl}/project/${projectId}`);
  }
    createTask(task: Task) {
    return this.http.post<Task>(this.apiUrl, task);
  }
  deleteTask(taskId: number){
    return this.http.delete<void>(`${this.apiUrl}/${taskId}`);
  }
}
