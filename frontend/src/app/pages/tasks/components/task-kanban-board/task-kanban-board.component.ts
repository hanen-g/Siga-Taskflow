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
import { finalize } from 'rxjs/operators';
import { CdkDrag, CdkDragDrop, CdkDropList, DragDropModule } from '@angular/cdk/drag-drop';

import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { Priority, Task, TaskStatus } from '../../../../models/task.model';
import { TaskService } from '../../../../services/task.service';
import { WebsocketService } from '../../../../services/websocket.service';
import { AppLoaderComponent } from '../../../../layout/app-loader';
import { TaskDetailsPanelComponent } from '../../task-details-panel';

type KanbanColumn = { status: TaskStatus; title: string; canDrop: boolean; colorClass: string };
type ManagerKanbanFilter = 'assigned_to_me' | 'assigned_to_others';
type TaskDateFilter = 'all' | 'overdue' | 'recently_added';
type TaskDateSort = 'none' | 'deadline_asc' | 'deadline_desc';

@Component({
  selector: 'app-task-kanban-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-kanban-board.component.html',
  styleUrls: ['./task-kanban-board.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    BadgeModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
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
  /** Taller columns when embedded (e.g. admin project detail). */
  @Input() tallEmbed = false;

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
  managerKanbanFilter: ManagerKanbanFilter = 'assigned_to_me';
  dateFilter: TaskDateFilter = 'all';
  dateSort: TaskDateSort = 'none';

  pauseDialogVisible = false;
  reviewDialogVisible = false;
  pauseHoldReason = '';
  pauseSubmitting = false;
  reviewNote = '';
  pendingTask: Task | null = null;
  pendingStatus: TaskStatus | null = null;

  private readonly subscriptions = new Subscription();
  private loadRequestSub?: Subscription;

  constructor(
    private readonly taskService: TaskService,
    private readonly ws: WebsocketService,
    private readonly cdr: ChangeDetectorRef,
    private readonly messageService: MessageService
  ) {}

  get isCollaborator(): boolean {
    return this.role === 'COLLABORATOR';
  }

  get isManager(): boolean {
    return this.role === 'PROJECT_MANAGER';
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
          if (notif.kind === 'TASK_ASSIGNED') {
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

  private readStoredUserEmail(): string | null {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        const email = user?.email;
        if (typeof email === 'string' && email.trim()) {
          return email.trim();
        }
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  isCurrentUserAssignee(task: Task | null | undefined): boolean {
    if (!task) {
      return false;
    }
    const currentEmail = this.readStoredUserEmail();
    if (!currentEmail) {
      return false;
    }
    const assignees = new Set<string>([
      ...(task.collaboratorEmails ?? []).map((e) => (e ?? '').trim().toLowerCase()),
      ...(task.collaborators?.map((c) => (c?.email ?? '').trim().toLowerCase()) ?? []),
      (task.collaboratorEmail ?? '').trim().toLowerCase()
    ]);
    return assignees.has(currentEmail.trim().toLowerCase());
  }

  isAssigneeExecutor(task: Task | null | undefined): boolean {
    return (this.isCollaborator || this.isManager) && this.isCurrentUserAssignee(task);
  }

  get canManageSelectedTaskStatus(): boolean {
    return this.isAssigneeExecutor(this.selectedTask);
  }

  isAssignedToCollaboratorsView(task: Task | null | undefined): boolean {
    if (!task || this.isCurrentUserAssignee(task)) {
      return false;
    }
    return this.hasAnyAssignee(task);
  }

  countManagerMyAssignedTasks(): number {
    if (!this.isManager) {
      return 0;
    }
    return this.tasks.filter((task) => this.isCurrentUserAssignee(task)).length;
  }

  countManagerCollaboratorTasks(): number {
    if (!this.isManager) {
      return 0;
    }
    return this.tasks.filter((task) => this.isAssignedToCollaboratorsView(task)).length;
  }

  setManagerFilter(filter: ManagerKanbanFilter): void {
    if (!this.isManager || this.managerKanbanFilter === filter) {
      return;
    }
    this.managerKanbanFilter = filter;
    this.rebuildColumnTasks();
    const visibleIds = new Set(
      this.getFilteredTasksForBoard().map((task) => task.id).filter((id): id is number => id != null)
    );
    if (this.selectedTask?.id != null && !visibleIds.has(this.selectedTask.id)) {
      this.selectedTask = null;
    }
    this.cdr.markForCheck();
  }

  setDateFilter(filter: TaskDateFilter): void {
    if (this.dateFilter === filter) {
      return;
    }
    this.dateFilter = filter;
    this.rebuildColumnTasks();
    this.clearSelectionIfTaskHidden();
    this.cdr.markForCheck();
  }

  setDateSort(sort: Exclude<TaskDateSort, 'none'>): void {
    this.dateSort = this.dateSort === sort ? 'none' : sort;
    this.rebuildColumnTasks();
    this.cdr.markForCheck();
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
        : this.taskService.getTasksForCurrentUser();

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
    return this.isAssigneeExecutor(task) && this.draggableStatuses.includes(task.status);
  }

  canDropInColumn(_column: KanbanColumn): boolean {
    return this.isCollaborator || this.isManager;
  }

  canEnterColumn = (drag: CdkDrag<Task>, drop: CdkDropList<Task[]>): boolean => {
    if (!this.isCollaborator && !this.isManager) {
      return false;
    }
    const source = drag.data;
    if (!this.isCurrentUserAssignee(source)) {
      return false;
    }
    const targetStatus = this.statusFromListId(drop.id);
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
    if (!task || task.status === targetStatus || !this.isAssigneeExecutor(task)) {
      return;
    }

    if (targetStatus === TaskStatus.ON_HOLD) {
      this.pendingTask = task;
      this.pendingStatus = targetStatus;
      this.pauseHoldReason = '';
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
    const taskId = this.pendingTask.id;
    if (!taskId) {
      return;
    }
    const holdReason = this.truncateHoldReason(this.pauseHoldReason);
    if (!holdReason) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Hold reason required',
        detail: 'Describe why you are putting this task on hold.'
      });
      return;
    }

    this.pauseSubmitting = true;
    this.cdr.markForCheck();

    this.taskService
      .updateTaskStatus(taskId, { status: TaskStatus.ON_HOLD, holdReason })
      .pipe(
        finalize(() => {
          this.pauseSubmitting = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.pauseDialogVisible = false;
          this.resetPendingDialogState();
          this.messageService.add({
            severity: 'success',
            summary: 'Task on hold',
            detail: 'The task was put on hold.'
          });
          this.loadTasks();
        },
        error: (err) => {
          console.error('Put task on hold failed', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Could not update status',
            detail:
              err?.error?.message ?? err?.error?.error ?? 'Could not put the task on hold. Try again.'
          });
        }
      });
  }

  confirmReview(): void {
    if (!this.pendingTask || this.pendingStatus !== TaskStatus.IN_REVIEW) {
      return;
    }
    this.reviewDialogVisible = false;
    this.changeStatus(this.pendingTask, TaskStatus.IN_REVIEW);
  }

  cancelPauseDialog(): void {
    if (this.pauseSubmitting) {
      return;
    }
    this.pauseDialogVisible = false;
    this.resetPendingDialogState();
  }

  cancelReviewDialog(): void {
    this.reviewDialogVisible = false;
    this.resetPendingDialogState();
  }

  get pauseDialogTitle(): string {
    const title = this.pendingTask?.title?.trim();
    return title ? `Put "${title}" on hold` : 'Put task on hold';
  }

  get reviewDialogTitle(): string {
    const title = this.pendingTask?.title?.trim();
    return title ? `Submit "${title}" for review` : 'Submit for review';
  }

  get reviewConfirmIntro(): string {
    const title = this.pendingTask?.title?.trim();
    const label = title ? `the task "${title}"` : 'this task';
    return `Are you sure you want to submit ${label} for review?`;
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
    this.pauseHoldReason = '';
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
    return `${prefix}-status-${status.toLowerCase().replaceAll('_', '-')}`;
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
    this.pauseHoldReason = '';
    this.reviewNote = '';
  }

  /** DB column limit safe summary for Task.holdReason. */
  private truncateHoldReason(raw: string): string {
    const singleLine = raw.replace(/\s+/g, ' ').trim();
    const max = 250;
    if (!singleLine) {
      return '';
    }
    if (singleLine.length <= max) {
      return singleLine;
    }
    return `${singleLine.slice(0, max - 1)}…`;
  }

  private getFilteredTasksForBoard(): Task[] {
    const dateFiltered = this.filteredTasks.filter((task) => this.matchesDateFilter(task));
    const managerScoped = this.getManagerScopedTasks(dateFiltered);
    return this.sortTasksForBoard(managerScoped);
  }

  private hasAnyAssignee(task: Task): boolean {
    const raw = [
      ...(task.collaboratorEmails ?? []),
      ...(task.collaborators?.map((c) => c?.email) ?? []),
      task.collaboratorEmail
    ];
    return raw.some((email) => typeof email === 'string' && email.trim().length > 0);
  }

  private rebuildColumnTasks(): void {
    const next: Record<TaskStatus, Task[]> = {
      [TaskStatus.TODO]: [],
      [TaskStatus.IN_PROGRESS]: [],
      [TaskStatus.ON_HOLD]: [],
      [TaskStatus.IN_REVIEW]: [],
      [TaskStatus.DONE]: []
    };
    for (const task of this.getFilteredTasksForBoard()) {
      if (next[task.status]) {
        next[task.status].push(task);
      }
    }
    this.columnTasks = next;
  }

  private clearSelectionIfTaskHidden(): void {
    if (this.selectedTask?.id == null) {
      return;
    }
    const visibleIds = new Set(
      this.getFilteredTasksForBoard().map((task) => task.id).filter((id): id is number => id != null)
    );
    if (!visibleIds.has(this.selectedTask.id)) {
      this.selectedTask = null;
    }
  }

  private getManagerScopedTasks(tasks: Task[]): Task[] {
    if (!this.isManager) {
      return tasks;
    }
    if (this.managerKanbanFilter === 'assigned_to_me') {
      return tasks.filter((task) => this.isCurrentUserAssignee(task));
    }
    return tasks.filter((task) => this.isAssignedToCollaboratorsView(task));
  }

  private matchesDateFilter(task: Task): boolean {
    switch (this.dateFilter) {
      case 'overdue': {
        return this.isOverdue(task);
      }
      case 'recently_added': {
        return this.isRecentlyAdded(task, this.filteredTasks);
      }
      case 'all':
      default:
        return true;
    }
  }

  private sortTasksForBoard(tasks: Task[]): Task[] {
    if (this.dateSort === 'none') {
      return tasks;
    }
    const copy = [...tasks];
    copy.sort((a, b) => this.compareTasks(a, b));
    return copy;
  }

  private compareTasks(a: Task, b: Task): number {
    switch (this.dateSort) {
      case 'deadline_asc':
        return this.compareDeadlineAsc(a, b);
      case 'deadline_desc':
        return this.compareDeadlineDesc(a, b);
      case 'none':
      default:
        return 0;
    }
  }

  private compareDeadlineAsc(a: Task, b: Task): number {
    const aTs = this.safeDateTimestamp(a.deadline);
    const bTs = this.safeDateTimestamp(b.deadline);
    if (aTs == null && bTs == null) {
      return this.compareRecentlyAdded(a, b);
    }
    if (aTs == null) {
      return 1;
    }
    if (bTs == null) {
      return -1;
    }
    if (aTs !== bTs) {
      return aTs - bTs;
    }
    return this.compareRecentlyAdded(a, b);
  }

  private compareDeadlineDesc(a: Task, b: Task): number {
    const aTs = this.safeDateTimestamp(a.deadline);
    const bTs = this.safeDateTimestamp(b.deadline);
    if (aTs == null && bTs == null) {
      return this.compareRecentlyAdded(a, b);
    }
    if (aTs == null) {
      return 1;
    }
    if (bTs == null) {
      return -1;
    }
    if (aTs !== bTs) {
      return bTs - aTs;
    }
    return this.compareRecentlyAdded(a, b);
  }

  private compareRecentlyAdded(a: Task, b: Task): number {
    const aCreated = this.resolveCreatedTimestamp(a);
    const bCreated = this.resolveCreatedTimestamp(b);
    if (aCreated == null && bCreated == null) {
      return (b.id ?? 0) - (a.id ?? 0);
    }
    if (aCreated == null) {
      return 1;
    }
    if (bCreated == null) {
      return -1;
    }
    if (aCreated !== bCreated) {
      return bCreated - aCreated;
    }
    return (b.id ?? 0) - (a.id ?? 0);
  }

  private isRecentlyAdded(task: Task, pool: Task[]): boolean {
    const createdTs = this.resolveCreatedTimestamp(task);
    if (createdTs != null) {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      return Date.now() - createdTs <= sevenDaysMs;
    }
    return this.isInTopMostRecentById(task, pool, 10);
  }

  private isInTopMostRecentById(task: Task, pool: Task[], topCount: number): boolean {
    const targetId = task.id ?? 0;
    if (targetId <= 0) {
      return false;
    }
    const ranked = pool
      .map((item) => item.id ?? 0)
      .filter((id) => id > 0)
      .sort((a, b) => b - a)
      .slice(0, topCount);
    return ranked.includes(targetId);
  }

  private resolveCreatedTimestamp(task: Task): number | null {
    const createdTs = this.safeDateTimestamp(task.createdAt);
    if (createdTs != null) {
      return createdTs;
    }
    const updatedTs = this.safeDateTimestamp(task.updatedAt);
    if (updatedTs != null) {
      return updatedTs;
    }
    return null;
  }

  private safeDateTimestamp(value?: string): number | null {
    if (!value) {
      return null;
    }
    const ts = new Date(value).getTime();
    return Number.isNaN(ts) ? null : ts;
  }

  private statusFromListId(listId: string): TaskStatus {
    const tail = listId.split('status-').pop() ?? '';
    const raw = tail.replaceAll('-', '_').toUpperCase();
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
