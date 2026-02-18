import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PanelModule } from 'primeng/panel';
import { ButtonModule } from 'primeng/button';
import { Observable } from 'rxjs';

import { TaskService } from '../../services/task.service';
import { Task, TaskStatus } from '../project_manager/projects/models/task.model';

@Component({
  selector: 'app-my-tasks',
  standalone: true,
  template: `
  <div class="flex flex-column gap-3 p-4">
    <h2>My Tasks</h2>

    <p-panel *ngFor="let task of tasks$ | async" [toggleable]="true">
      <ng-template pTemplate="header">
        <div class="flex justify-content-between w-full">
            <p>{{ task.projectName }}</p>
          <span class="font-bold"> Task: {{ task.title }}</span>
        </div>
      </ng-template>

      <div class="flex flex-column gap-2">
        <p>Description: {{ task.description }}</p>

        <div class="flex gap-2 align-items-center">
          <label>Status:</label>
          <select [(ngModel)]="task.status" (change)="updateStatus(task)">
            <option *ngFor="let s of statuses" [value]="s">{{ s }}</option>
          </select>
        </div>
      </div>
    </p-panel>

    <small *ngIf="(tasks$ | async)?.length === 0">No assigned tasks yet.</small>
  </div>
  `,
  imports: [CommonModule, FormsModule, PanelModule, ButtonModule]
})
export class MyTasksPage implements OnInit {

  tasks$!: Observable<Task[]>;
  statuses: TaskStatus[] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE];

  constructor(private taskService: TaskService) {}

  ngOnInit() {
    this.tasks$ = this.taskService.getMyTasks();
  }

  updateStatus(task: Task) {
    this.taskService.updateTaskStatus(task.id!, task.status).subscribe({
      next: () => console.log(`Task ${task.id} status updated to ${task.status}`),
      error: (err) => console.error('Failed to update status', err)
    });
  }
}
