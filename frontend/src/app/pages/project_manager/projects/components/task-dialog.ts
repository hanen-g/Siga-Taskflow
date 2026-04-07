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
  template: ``,
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