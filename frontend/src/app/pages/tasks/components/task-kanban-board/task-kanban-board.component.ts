import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges
} from '@angular/core';
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

import { Priority, Task, TaskStatus } from '../../../../models/task.model';
import { TaskService } from '../../../../services/task.service';
import { WebsocketService } from '../../../../services/websocket.service';
import { AppLoaderComponent } from '../../../../layout/app-loader';
import { TaskDetailsPanelComponent } from '../task-details-panel';

type KanbanColumn = { status: TaskStatus; title: string; canDrop: boolean; colorClass: string };

@Component({
  selector: 'app-task-kanban-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-kanban-board.component.html',
  styleUrls: ['../../tasks-page.css'],
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
    TaskDetailsPanelComponent
  ],
  providers: [MessageService]
})
export class TaskKanbanBoardComponent implements OnInit, OnDestroy, OnChanges {
  /** When set, loads only tasks for this project (project detail embed). Omit for global Kanban routes. */
  @Input() projectId?: number;
  /** Optional filter line (e.g. project detail search bar). */
  @Input() filterText = '';

  tasks: Task[] = [];
  filteredTasks: Task[] = [];
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

  readonly draggableStatuses: TaskStatus[] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.ON_HOLD];

  isLoading = true;
  errorMessage = '';
  role: string | null = null;
  selectedTask: Task | null = null;

  pauseDialogVisible = false;
  reviewDialogVisible = false;
  pauseReason = '';
  reviewNote = '';
  pendingTask: Task | null = null;
  pendingStatus: TaskStatus | null = null;

  private readonly subscriptions = new Subscription();
  private loadRequestSub?: Subscription;

  constructor(
    private taskService: TaskService,
    private ws: WebsocketService,
    private cdr: ChangeDetectorRef,
    private messageService: MessageService
  ) {}

  get isCollaborator(): boolean {
    return this.role === 'COLLABORATOR';
  }

  get isClient(): boolean {
    return this.role === 'CLIENT';
  }

  ngOnInit(): void {
    this.detectRole();
    this.loadTasks();

    if (this.projectId != null) {
      this.subscriptions.add(
        this.ws.subscribeToProject(this.projectId).subscribe(() => this.loadTasks())
      );
    } else {
      this.subscriptions.add(this.ws.getTaskUpdates().subscribe(() => this.loadTasks()));
      this.subscriptions.add(
        this.ws.getNotificationStream().subscribe((notif) => {
          if ((notif.message ?? '').toLowerCase().includes('new task assigned')) {
            this.loadTasks();
          }
        })
      );
    }

    this.subscriptions.add(this.taskService.refresh$.subscribe(() => this.loadTasks()));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['projectId'] && !changes['projectId'].firstChange && this.projectId != null) {
      this.loadTasks();
    }
    if (changes['filterText']) {
      this.applyTextFilter();
      this.rebuildColumnTasks();
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.loadRequestSub?.unsubscribe();
    this.subscriptions.unsubscribe();
  }

  taskCardDescription(task: Task): string {
    const desc = (task.description ?? '').trim();
    if (desc) return desc;
    if (this.projectId == null) {
      const pn = task.projectName?.trim();
      if (pn) return pn;
    }
    return 'No description provided.';
  }

  detectRole(): void {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user?.role) {
          this.role = user.role;
          return;
        }
      } catch {
        /* ignore */
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

    const request$ =
      this.projectId != null
        ? this.taskService.getTasksByProject(this.projectId)
        : this.isCollaborator
          ? this.taskService.getMyTasks()
          : this.role === 'PROJECT_MANAGER'
            ? this.taskService.getManagerTasks()
            : this.taskService.getAllTasks();

    this.loadRequestSub?.unsubscribe();
    this.loadRequestSub = request$.subscribe({
      next: (tasks) => {
        this.tasks = tasks;
        this.applyTextFilter();
        this.rebuildColumnTasks();
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        console.error('Failed to load tasks');
        this.errorMessage = 'Could not load tasks. Please try again.';
        this.tasks = [];
        this.filteredTasks = [];
        this.rebuildColumnTasks();
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private applyTextFilter(): void {
    const q = this.filterText.trim().toLowerCase();
    if (!q) {
      this.filteredTasks = [...this.tasks];
      return;
    }
    this.filteredTasks = this.tasks.filter((task) => {
      const title = String(task.title ?? '').toLowerCase();
      const desc = String(task.description ?? '').toLowerCase();
      const pname = String(task.projectName ?? '').toLowerCase();
      return title.includes(q) || desc.includes(q) || pname.includes(q);
    });
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
    if (source?.status === TaskStatus.TODO) {
      return targetStatus === TaskStatus.IN_PROGRESS || targetStatus === TaskStatus.ON_HOLD;
    }
    return (
      targetStatus === TaskStatus.IN_PROGRESS ||
      targetStatus === TaskStatus.ON_HOLD ||
      targetStatus === TaskStatus.IN_REVIEW
    );
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
      case Priority.LOW:
        return 'priority-low';
      case Priority.MEDIUM:
        return 'priority-medium';
      case Priority.HIGH:
        return 'priority-high';
      case Priority.URGENT:
        return 'priority-urgent';
      default:
        return 'priority-low';
    }
  }

  statusListId(status: TaskStatus): string {
    const prefix = this.projectId != null ? `p${this.projectId}` : 'g';
    return `${prefix}-status-${status.toLowerCase().replace(/_/g, '-')}`;
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
          detail:
            err?.error?.message ?? err?.error?.error ?? 'Could not update task status. Please try again.'
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
    for (const task of this.filteredTasks) {
      if (next[task.status]) {
        next[task.status].push(task);
      }
    }
    this.columnTasks = next;
  }

  private statusFromListId(listId: string): TaskStatus {
    const tail = listId.split('status-').pop() ?? '';
    const raw = tail.replace(/-/g, '_').toUpperCase();
    switch (raw) {
      case 'TODO':
        return TaskStatus.TODO;
      case 'IN_PROGRESS':
        return TaskStatus.IN_PROGRESS;
      case 'ON_HOLD':
        return TaskStatus.ON_HOLD;
      case 'IN_REVIEW':
        return TaskStatus.IN_REVIEW;
      case 'DONE':
        return TaskStatus.DONE;
      default:
        return TaskStatus.TODO;
    }
  }
}
