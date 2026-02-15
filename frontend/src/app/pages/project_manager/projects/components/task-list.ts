import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { PanelModule } from 'primeng/panel';

import { TaskService } from '../../../../services/task.service';
import { Task } from '../models/task.model';
import { TaskDialog } from './task-dialog';

@Component({
  selector: 'app-task-list',
  standalone: true,
  template: `<div class="flex flex-column gap-2">

  <div *ngFor="let task of (tasks$ | async)"
       class="task-item cursor-pointer"
       (click)="openTask(task)">
    {{ task.title }}
  </div>

  <small *ngIf="(tasks$ | async)?.length === 0">
    No tasks yet
  </small>

</div>

<app-task-dialog
  *ngIf="selectedTask"
  [task]="selectedTask"
  (close)="closeDialog()">
</app-task-dialog>
`,
  imports: [
    CommonModule,
    TaskDialog
  ]
})
export class TaskList implements OnInit {

  @Input() projectId!: number;

  tasks$!: Observable<Task[]>;
  selectedTask: Task | null = null;

  constructor(private taskService: TaskService) {}

  ngOnInit() {
    this.loadTasks();

    window.addEventListener('taskCreated', () => {
      this.loadTasks();
    });
  }

  loadTasks() {
    this.tasks$ = this.taskService.getTasksByProject(this.projectId);
  }
  
  openTask(task: Task) {
    this.selectedTask = task;
  }

  closeDialog() {
    this.selectedTask = null;
  }
}
