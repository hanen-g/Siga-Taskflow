import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

import { Task } from '../models/task.model';
import { TaskService } from '../../../../services/task.service';


@Component({
  selector: 'app-task-dialog',
  standalone: true,
  template: `<p-dialog
  header="Task Details"
  [(visible)]="visible"
  [modal]="true"
  [style]="{width:'500px'}"
  (onHide)="onClose()">

  <div>
    <h3>{{ task.title }}</h3>
    <p>{{ task.description }}</p>
    <p>Status: {{ task.status }}</p>
    <p>Assigned: {{ task.collaboratorEmail }}</p>
  </div>

  <div class="flex justify-content-end gap-2 mt-3">
  <button
  pButton
  type="button"
  label="Delete"
  icon="pi pi-trash"
  class="p-button p-button-danger"
  (click)="deleteTask()">
</button>

  </div>

</p-dialog>
`,
  imports: [CommonModule, DialogModule, ButtonModule]
})
export class TaskDialog {
  constructor(private taskService: TaskService) {}

  @Input() task!: Task;
  @Output() close = new EventEmitter<void>();

  visible = true;

  onClose() {
    this.visible = false;
    this.close.emit();
  }

  deleteTask() {
  if (!this.task?.id) return;

  this.taskService.deleteTask(this.task.id).subscribe({
    next: () => {
      this.close.emit();
      window.dispatchEvent(new CustomEvent('taskCreated'));
    },
    error: (err) => console.error('Delete failed', err)
  });
}

}
