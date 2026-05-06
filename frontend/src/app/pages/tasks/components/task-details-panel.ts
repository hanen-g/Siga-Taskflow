import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';

import { Task, TaskStatus, Priority } from '../../../models/task.model';
import { TaskService } from '../../../services/task.service';
import { TaskReportService } from '../../../services/task-report.service';

@Component({
  selector: 'app-task-details-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-details-panel.html',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TooltipModule,
    DialogModule,
    TextareaModule
  ],
  styles: [`
    .task-details-panel {
      width: 400px;
      height: 100vh;
      background: white;
      border-left: 1px solid #e9ecef;
      display: flex;
      flex-direction: column;
      position: fixed;
      right: 0;
      top: 0;
      z-index: 1000;
      box-shadow: -2px 0 8px rgba(0,0,0,0.1);
    }

    .panel-header {
      padding: 1rem;
      border-bottom: 1px solid #e9ecef;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }

    .task-title-section {
      flex: 1;
    }

    .task-title {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .task-badges {
      display: flex;
      gap: 0.5rem;
    }

    .status-badge, .priority-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .status-pending { background: #fef3c7; color: #92400e; }
    .status-inprogress { background: #dbeafe; color: #1e40af; }
    .status-onhold { background: #ffedd5; color: #9a3412; }
    .status-inreview { background: #ede9fe; color: #5b21b6; }
    .status-completed { background: #d1fae5; color: #065f46; }

    .priority-low { background: #f3f4f6; color: #374151; }
    .priority-medium { background: #fef3c7; color: #92400e; }
    .priority-high { background: #fee2e2; color: #991b1b; }
    .priority-urgent { background: #fef2f2; color: #7f1d1d; }

    .close-btn {
      background: none;
      border: none;
      color: #6b7280;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 4px;
    }

    .close-btn:hover {
      background: #f3f4f6;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .attach-btn,
    .report-btn {
      background: none;
      border: none;
      color: #6b7280;
      cursor: pointer;
      padding: 0.35rem;
      border-radius: 4px;
      line-height: 1;
      flex-shrink: 0;
    }

    .attach-btn:hover:not(:disabled),
    .report-btn:hover:not(:disabled) {
      background: #f3f4f6;
      color: #374151;
    }

    .attach-btn:disabled,
    .report-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .attach-btn .pi,
    .report-btn .pi {
      font-size: 0.875rem;
    }

    .report-btn {
      color: #b45309;
    }

    .panel-content {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .task-info-section {
      padding: 1rem;
      border-bottom: 1px solid #e9ecef;
    }

    .info-item {
      margin-bottom: 0.75rem;
    }

    .info-item:last-child {
      margin-bottom: 0;
    }

    .info-item label {
      display: block;
      font-weight: 500;
      color: #374151;
      margin-bottom: 0.25rem;
    }

    .description {
      color: #6b7280;
      line-height: 1.5;
    }

    .task-footer-actions {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 1rem;
    }

    .status-actions {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .status-info-label {
      font-weight: 600;
      color: #6b7280;
    }

    .report-form {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
    }

    .report-form label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.35rem;
      color: #374151;
    }

    .report-form select,
    .report-form textarea {
      width: 100%;
    }
  `]
})
export class TaskDetailsPanelComponent {
  @Input() task: Task | null = null;
  @Input() canManageStatus = false;
  @Input() showAssignedTo = true;
  @Output() close = new EventEmitter<void>();
  @Output() requestStart = new EventEmitter<Task>();
  @Output() requestPause = new EventEmitter<Task>();
  @Output() requestResume = new EventEmitter<Task>();

  isUploading = false;
  reportDialogVisible = false;
  isReporting = false;
  reportReason = 'Task is not aligned with my skills';
  reportDetails = '';
  readonly reportReasons = [
    'Task is not aligned with my skills',
    'I have too many tasks',
    'Missing file or task information',
    'Deadline or priority problem',
    'Other problem'
  ];

  constructor(
    private taskService: TaskService,
    private taskReportService: TaskReportService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  getAssigneeName(): string {
    if (!this.task?.collaboratorEmails?.length) return 'Unassigned';
    return this.task.collaboratorEmails.join(', ');
  }

  statusLabel(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.TODO: return 'To Do';
      case TaskStatus.IN_PROGRESS: return 'In Progress';
      case TaskStatus.ON_HOLD: return 'On Hold';
      case TaskStatus.IN_REVIEW: return 'In Review';
      case TaskStatus.DONE: return 'Done';
      default: return status;
    }
  }

  priorityLabel(priority: Priority): string {
    switch (priority) {
      case Priority.LOW: return 'Low';
      case Priority.MEDIUM: return 'Medium';
      case Priority.HIGH: return 'High';
      case Priority.URGENT: return 'Urgent';
      default: return priority;
    }
  }

  getStatusClass(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.TODO: return 'status-pending';
      case TaskStatus.IN_PROGRESS: return 'status-inprogress';
      case TaskStatus.ON_HOLD: return 'status-onhold';
      case TaskStatus.IN_REVIEW: return 'status-inreview';
      case TaskStatus.DONE: return 'status-completed';
      default: return '';
    }
  }

  get showTodoActions(): boolean {
    return this.canManageStatus && this.task?.status === TaskStatus.TODO;
  }

  get showResumeAction(): boolean {
    return this.canManageStatus && this.task?.status === TaskStatus.ON_HOLD;
  }

  get reviewWaitingLabel(): boolean {
    return this.task?.status === TaskStatus.IN_REVIEW;
  }

  get doneLabel(): boolean {
    return this.task?.status === TaskStatus.DONE;
  }

  onStart(): void {
    if (this.task) {
      this.requestStart.emit(this.task);
    }
  }

  onPause(): void {
    if (this.task) {
      this.requestPause.emit(this.task);
    }
  }

  onResume(): void {
    if (this.task) {
      this.requestResume.emit(this.task);
    }
  }

  getPriorityClass(priority: Priority): string {
    switch (priority) {
      case Priority.LOW: return 'priority-low';
      case Priority.MEDIUM: return 'priority-medium';
      case Priority.HIGH: return 'priority-high';
      case Priority.URGENT: return 'priority-urgent';
      default: return '';
    }
  }

  onTaskFileChosen(inputEl: HTMLInputElement): void {
    const file = inputEl.files?.[0];
    inputEl.value = '';
    const taskId = this.task?.id;
    if (!file || !taskId) {
      return;
    }

    this.isUploading = true;
    this.cdr.markForCheck();

    this.taskService.uploadTaskFile(taskId, file).subscribe({
      next: () => {
        this.isUploading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to upload file', err);
        this.isUploading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Upload failed',
          detail: err?.error?.message ?? err?.error?.error ?? 'Could not upload attachment. Try again.'
        });
        this.cdr.markForCheck();
      }
    });
  }

  openReportDialog(): void {
    this.reportReason = this.reportReasons[0];
    this.reportDetails = '';
    this.reportDialogVisible = true;
    this.cdr.markForCheck();
  }

  submitReport(): void {
    const taskId = this.task?.id;
    if (!taskId || this.isReporting) {
      return;
    }
    if (!this.reportReason.trim() || !this.reportDetails.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Report incomplete',
        detail: 'Choose a reason and describe the problem for the project manager.'
      });
      return;
    }

    this.isReporting = true;
    this.taskReportService.createReport(taskId, {
      reason: this.reportReason.trim(),
      details: this.reportDetails.trim()
    }).subscribe({
      next: () => {
        this.isReporting = false;
        this.reportDialogVisible = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Report sent',
          detail: 'The project manager has been notified.'
        });
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to report task problem', err);
        this.isReporting = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Report failed',
          detail: err?.error?.message ?? err?.error?.error ?? 'Could not send the report. Try again.'
        });
        this.cdr.markForCheck();
      }
    });
  }
}
