import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TaskService } from '../../../../services/task.service';
import { Task } from '../../../../models/task.model';

@Component({
  selector: 'app-task-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<p-dialog
  header="Task Details"
  [visible]="true"
  [modal]="true"
  [style]="{width:'500px'}"
  (onHide)="close.emit()">

  <h3>{{ task.title }}</h3>
  <p>{{ task.description }}</p>
  <p>Status: {{ task.status }}</p>
  <p>Assigned: {{ task.collaboratorEmail }}</p>

  <div class="flex justify-content-end mt-3">
    <button pButton
            label="Delete"
            icon="pi pi-trash"
            class="p-button-danger"
            (click)="deleteTask()">
    </button>
  </div>
</p-dialog>
  `,
  imports: [CommonModule, DialogModule, ButtonModule]
})
export class TaskDialog {
  @Input() task!: Task;
  @Output() close = new EventEmitter<void>();

  constructor(private taskService: TaskService) {}

  deleteTask() {
    this.taskService.deleteTask(this.task.id!).subscribe(() => {
      this.close.emit();
    });
  }
}