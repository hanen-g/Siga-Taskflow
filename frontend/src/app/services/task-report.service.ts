import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TaskReport, TaskReportRequest } from '../models/task-report.model';

@Injectable({ providedIn: 'root' })
export class TaskReportService {
  private readonly apiUrl = 'http://localhost:8080/api/task-reports';

  constructor(private http: HttpClient) {}

  createReport(taskId: number, payload: TaskReportRequest): Observable<TaskReport> {
    return this.http.post<TaskReport>(`${this.apiUrl}/tasks/${taskId}`, payload);
  }

  getManagerReports(): Observable<TaskReport[]> {
    return this.http.get<TaskReport[]>(`${this.apiUrl}/manager`);
  }

  resolveReport(reportId: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${reportId}/resolve`, {});
  }
}
