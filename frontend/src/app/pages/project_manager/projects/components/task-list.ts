import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, merge, startWith, switchMap } from 'rxjs';

import { TaskService } from '../../../../services/task.service';
import { WebsocketService } from '../../../../services/websocket.service';
import { Task } from '../../../../models/task.model';
import { TaskDialog } from './task-dialog';

@Component({
  selector: 'app-task-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="flex flex-column gap-2">
  <div *ngFor="let task of tasks$ | async"
       class="task-item"
       (click)="selectedTask = task">
    {{ task.title }}
  </div>

  <small *ngIf="(tasks$ | async)?.length === 0">
    No tasks yet
  </small>
</div>

<app-task-dialog
  *ngIf="selectedTask"
  [task]="selectedTask"
  (close)="selectedTask = null">
</app-task-dialog>
  `,
  imports: [CommonModule, TaskDialog]
})
export class TaskList implements OnInit {
  @Input() projectId!: number;
  tasks$!: Observable<Task[]>;
  selectedTask: Task | null = null;

  constructor(private taskService: TaskService, private ws: WebsocketService) {}

  ngOnInit() {
    const wsProject$ = this.ws.subscribeToProject(this.projectId);

    this.tasks$ = merge(
      this.taskService.refresh$,
      wsProject$
    ).pipe(
      startWith(null),
      switchMap(() => this.taskService.getTasksByProject(this.projectId))
    );
  }
}