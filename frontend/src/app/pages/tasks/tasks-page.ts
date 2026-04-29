import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CdkDrag, CdkDragDrop, CdkDropList, DragDropModule } from '@angular/cdk/drag-drop';

import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { Priority, Task, TaskStatus } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { WebsocketService } from '../../services/websocket.service';
import { AppLoaderComponent } from '../../layout/app-loader';
import { TaskDetailsPanelComponent } from './components/task-details-panel';

type KanbanColumn = { status: TaskStatus; title: string; canDrop: boolean; colorClass: string };

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tasks-page.html',
  styleUrls: ['./tasks-page.css'],
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    BadgeModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    ToastModule,
    AppLoaderComponent,
    TaskDetailsPanelComponent,
  ],
  providers: [MessageService]
})
export class TasksPage implements OnInit, OnDestroy {
  tasks: Task[] = [];
  columns: KanbanColumn[] = [
    { status: TaskStatus.TODO, title: 'To Do', canDrop: false, colorClass: 'col-todo' },
    { status: TaskStatus.IN_PROGRESS, title: 'In Progress', canDrop: true, colorClass: 'col-progress' },
    { status: TaskStatus.ON_HOLD, title: 'On Hold', canDrop: true, colorClass: 'col-hold' },
    { status: TaskStatus.IN_REVIEW, title: 'In Review', canDrop: true, colorClass: 'col-review' },
    { status: TaskStatus.DONE, title: 'Done', canDrop: false, colorClass: 'col-done' }
  ];
  columnTasks: Record<TaskStatus, Task[]> = {
    [TaskStatus.TODO]: [],
    [TaskStatus.IN_PROGRESS]: [],
    [TaskStatus.ON_HOLD]: [],
    [TaskStatus.IN_REVIEW]: [],
    [TaskStatus.DONE]: []
  };

  /** Collaborator can drag from To Do, In Progress, or On Hold (not In Review / Done). */
  readonly draggableStatuses: TaskStatus[] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.ON_HOLD];

  isLoading = true;
  errorMessage = '';
  role: string | null = null;
  pageTitle = 'Collaborator Kanban';
  selectedTask: Task | null = null;

  pauseDialogVisible = false;
  reviewDialogVisible = false;
  pauseReason = '';
  reviewNote = '';
  pendingTask: Task | null = null;
  pendingStatus: TaskStatus | null = null;

  private readonly subscriptions = new Subscription();

  constructor(
    private taskService: TaskService,
    private ws: WebsocketService,
    private cdr: ChangeDetectorRef,
    private messageService: MessageService
  ) {}

  get isManager(): boolean {
    return this.role === 'PROJECT_MANAGER';
  }

  get isCollaborator(): boolean {
    return this.role === 'COLLABORATOR';
  }

  get isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  ngOnInit() {
    this.detectRole();
    this.pageTitle = this.isCollaborator ? 'Collaborator Kanban' : 'Kanban Tasks';
    this.loadTasks();

    this.subscriptions.add(
      this.ws.getTaskUpdates().subscribe(() => {
        this.loadTasks();
      })
    );

    this.subscriptions.add(
      this.ws.getNotificationStream().subscribe((notif) => {
        if ((notif.message ?? '').toLowerCase().includes('new task assigned')) {
          this.loadTasks();
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  detectRole() {
    const userData = localStorage.getItem('user');

    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user?.role) {
          this.role = user.role;
          return;
        }
      } catch {
        // fallback to token parse.
      }
    }

    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.role = payload.role;
      } catch {
        this.role = null;
      }
    }
  }

  loadTasks(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    const request$ = this.isCollaborator
      ? this.taskService.getMyTasks()
      : this.isManager
      ? this.taskService.getManagerTasks()
      : this.taskService.getAllTasks();

    this.subscriptions.add(
      request$.subscribe({
        next: (tasks) => {
          this.tasks = tasks;
          this.rebuildColumnTasks();
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load tasks', err);
          this.errorMessage = 'Could not load tasks. Please try again.';
          this.tasks = [];
          this.rebuildColumnTasks();
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      })
    );
  }

  tasksByStatus(status: TaskStatus): Task[] {
    return this.columnTasks[status];
  }

  countByStatus(status: TaskStatus): number {
    return this.tasksByStatus(status).length;
  }

  canDragTask(task: Task): boolean {
    return this.isCollaborator && this.draggableStatuses.includes(task.status);
  }

  canDropInColumn(_column: KanbanColumn): boolean {
    return this.isCollaborator;
  }

  canEnterColumn = (drag: CdkDrag<Task>, drop: CdkDropList<Task[]>): boolean => {
    if (!this.isCollaborator) {
      return false;
    }
    const targetStatus = this.statusFromListId(drop.id);
    const source = drag.data;
    // From To Do: only In Progress or On Hold (not directly to In Review / Done / back to To Do)
    if (source?.status === TaskStatus.TODO) {
      return targetStatus === TaskStatus.IN_PROGRESS || targetStatus === TaskStatus.ON_HOLD;
    }
    return targetStatus === TaskStatus.IN_PROGRESS
      || targetStatus === TaskStatus.ON_HOLD
      || targetStatus === TaskStatus.IN_REVIEW;
  };

  onTaskDrop(event: CdkDragDrop<Task[]>, targetStatus: TaskStatus): void {
    const task = event.item.data as Task;
    if (!task || task.status === targetStatus || !this.isCollaborator) {
      return;
    }

    if (targetStatus === TaskStatus.ON_HOLD) {
      this.pendingTask = task;
      this.pendingStatus = targetStatus;
      this.pauseReason = '';
      this.pauseDialogVisible = true;
      return;
    }

    if (targetStatus === TaskStatus.IN_REVIEW) {
      this.pendingTask = task;
      this.pendingStatus = targetStatus;
      this.reviewNote = '';
      this.reviewDialogVisible = true;
      return;
    }

    if (task.status === TaskStatus.ON_HOLD && targetStatus === TaskStatus.IN_PROGRESS) {
      this.changeStatus(task, TaskStatus.IN_PROGRESS, null);
      return;
    }

    this.changeStatus(task, targetStatus);
  }

  confirmPause(): void {
    if (!this.pendingTask || this.pendingStatus !== TaskStatus.ON_HOLD) {
      return;
    }
    if (!this.pauseReason.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Reason required',
        detail: 'Please enter a reason for putting the task on hold.'
      });
      return;
    }
    this.pauseDialogVisible = false;
    this.changeStatus(this.pendingTask, TaskStatus.ON_HOLD, this.pauseReason.trim());
  }

  confirmReview(): void {
    if (!this.pendingTask || this.pendingStatus !== TaskStatus.IN_REVIEW) {
      return;
    }
    this.reviewDialogVisible = false;
    this.changeStatus(this.pendingTask, TaskStatus.IN_REVIEW);
  }

  cancelPauseDialog(): void {
    this.pauseDialogVisible = false;
    this.resetPendingDialogState();
  }

  cancelReviewDialog(): void {
    this.reviewDialogVisible = false;
    this.resetPendingDialogState();
  }

  selectTask(task: Task): void {
    this.selectedTask = task;
    this.cdr.markForCheck();
  }

  closeTaskDetails(): void {
    this.selectedTask = null;
    this.cdr.markForCheck();
  }

  requestPauseFromPanel(task: Task): void {
    this.pendingTask = task;
    this.pendingStatus = TaskStatus.ON_HOLD;
    this.pauseReason = '';
    this.pauseDialogVisible = true;
  }

  requestResumeFromPanel(task: Task): void {
    this.changeStatus(task, TaskStatus.IN_PROGRESS, null);
  }

  /** To Do → In Progress (same as dragging to In Progress column). */
  requestStartFromPanel(task: Task): void {
    this.changeStatus(task, TaskStatus.IN_PROGRESS);
  }

  formatDeadline(deadline?: string): string {
    if (!deadline) return '-';
    return new Date(deadline).toLocaleDateString('fr-FR');
  }

  isOverdue(task: Task): boolean {
    if (!task.deadline || task.status === TaskStatus.DONE) {
      return false;
    }
    return new Date(task.deadline).getTime() < Date.now();
  }

  getPriorityClass(priority?: Priority): string {
    switch (priority) {
      case Priority.LOW: return 'priority-low';
      case Priority.MEDIUM: return 'priority-medium';
      case Priority.HIGH: return 'priority-high';
      case Priority.URGENT: return 'priority-urgent';
      default: return 'priority-low';
    }
  }

  getPriorityLabel(priority?: Priority): string {
    return priority ?? 'LOW';
  }

  statusListId(status: TaskStatus): string {
    return `status-${status.toLowerCase()}`;
  }

  connectedDropLists(): string[] {
    return this.columns.map((column) => this.statusListId(column.status));
  }

  trackByColumn(_index: number, column: KanbanColumn): TaskStatus {
    return column.status;
  }

  trackByTask(_index: number, task: Task): number | undefined {
    return task.id;
  }

  private changeStatus(task: Task, status: TaskStatus, holdReason?: string | null): void {
    if (!task.id) {
      return;
    }
    this.taskService.updateTaskStatus(task.id, { status, holdReason }).subscribe({
      next: () => {
        this.resetPendingDialogState();
        this.loadTasks();
      },
      error: (err) => {
        console.error('Failed to update status', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err?.error?.message ?? err?.error?.error ?? 'Could not update task status. Please try again.'
        });
        this.resetPendingDialogState();
      }
    });
  }

  private resetPendingDialogState(): void {
    this.pendingTask = null;
    this.pendingStatus = null;
    this.pauseReason = '';
    this.reviewNote = '';
  }

  private rebuildColumnTasks(): void {
    const next: Record<TaskStatus, Task[]> = {
      [TaskStatus.TODO]: [],
      [TaskStatus.IN_PROGRESS]: [],
      [TaskStatus.ON_HOLD]: [],
      [TaskStatus.IN_REVIEW]: [],
      [TaskStatus.DONE]: []
    };
    for (const task of this.tasks) {
      if (next[task.status]) {
        next[task.status].push(task);
      }
    }
    this.columnTasks = next;
  }

  private statusFromListId(listId: string): TaskStatus {
    const raw = listId.replace('status-', '').toUpperCase();
    switch (raw) {
      case 'TODO': return TaskStatus.TODO;
      case 'IN_PROGRESS': return TaskStatus.IN_PROGRESS;
      case 'ON_HOLD': return TaskStatus.ON_HOLD;
      case 'IN_REVIEW': return TaskStatus.IN_REVIEW;
      case 'DONE': return TaskStatus.DONE;
      default: return TaskStatus.TODO;
    }
  }
}
