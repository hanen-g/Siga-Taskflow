import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, of } from 'rxjs';
import { catchError, map, startWith } from 'rxjs/operators';

import { AutoCompleteModule } from 'primeng/autocomplete';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';

import { Task, TaskStatus, Priority } from '../../models/task.model';
import { TaskMessage } from '../../models/task-message.model';
import { TaskService } from '../../services/task.service';
import { ApiService } from '../../services/api';
import { UserService } from '../../services/user.service';
import { WebsocketService } from '../../services/websocket.service';
import { AppLoaderComponent } from '../../layout/app-loader';
import { TaskDetailsPanelComponent } from './components/task-details-panel';

type TaskFilterKey = 'all' | 'pending' | 'inProgress' | 'completed';

type GroupedTasks = { status: TaskStatus; title: string; tasks: Task[] };

type FilterTab = { key: TaskFilterKey; label: string; icon: string; badge: number | null };

const STATUS_CONFIG: Record<Exclude<TaskFilterKey, 'all'>, { status: TaskStatus; label: string; className: string; titleSuffix: string }> = {
  pending: {
    status: TaskStatus.TODO,
    label: 'Pending',
    className: 'status-pending',
    titleSuffix: 'Tasks Pending',
  },
  inProgress: {
    status: TaskStatus.IN_PROGRESS,
    label: 'In progress',
    className: 'status-inprogress',
    titleSuffix: 'Tasks In Progress',
  },
  completed: {
    status: TaskStatus.DONE,
    label: 'Completed',
    className: 'status-completed',
    titleSuffix: 'Tasks Completed',
  },
};

const FILTER_TAB_CONFIG: ReadonlyArray<Omit<FilterTab, 'badge'>> = [
  { key: 'all', label: 'All', icon: 'pi-list' },
  { key: 'pending', label: 'Pending', icon: 'pi-clock' },
  { key: 'inProgress', label: 'In Progress', icon: 'pi-spinner' },
  { key: 'completed', label: 'Completed', icon: 'pi-check' },
];

/** Section order when showing “All”: in progress first, completed last. */
const GROUP_SECTION_ORDER: ReadonlyArray<Exclude<TaskFilterKey, 'all'>> = ['inProgress', 'pending', 'completed'];

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tasks-page.html',
  styleUrls: ['./tasks-page.css'],
  imports: [
    CommonModule,
    FormsModule,
    AutoCompleteModule,
    AvatarModule,
    ButtonModule,
    CardModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    TooltipModule,
    AppLoaderComponent,
    TaskDetailsPanelComponent,
  ],
})
export class TasksPage implements OnInit, OnDestroy {
  tasks$: Observable<Task[] | null> = of(null);
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  statuses: TaskStatus[] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE];
  priorities: Priority[] = [Priority.LOW, Priority.MEDIUM, Priority.HIGH];

  activeFilter: TaskFilterKey = 'all';
  searchText = '';
  isLoading = false;
  errorMessage = '';
  isSaving = false;
  drawerErrorMessage = '';
  role: string | null = null;
  pageTitle = 'Tasks';

  collapsedSections: Record<TaskStatus, boolean> = {
    [TaskStatus.TODO]: false,
    [TaskStatus.IN_PROGRESS]: false,
    [TaskStatus.ON_HOLD]: false,
    [TaskStatus.IN_REVIEW]: false,
    [TaskStatus.DONE]: false,
  };

  filterTabs: FilterTab[] = [];
  groupedTasks: GroupedTasks[] = [];

  isEditDialogOpen = false;
  selectedTask: Task | null = null;
  editForm = { title: '', description: '', collaboratorEmails: [] as string[], priority: null as Priority | null, deadline: null as string | null };
  memberSearch = '';
  memberSuggestions: string[] = [];

  private readonly subscriptions = new Subscription();

  constructor(
    private taskService: TaskService,
    private api: ApiService,
    private userService: UserService,
    private ws: WebsocketService,
    private cdr: ChangeDetectorRef
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

  /** Only project managers may create, edit, or delete tasks. Admins have read-only access. */
  get canManageTasks(): boolean {
    return this.isManager;
  }

  ngOnInit() {
    this.detectRole();
    this.pageTitle = this.isManager
      ? 'Tasks'
      : this.isCollaborator
        ? 'My Tasks'
        : 'All tasks';
    this.updateFilterTabs();
    this.loadTasks();

    this.subscriptions.add(
      this.ws.getTaskUpdates().subscribe((_msg: TaskMessage) => {
        this.loadTasks();
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  detectRole() {
    this.role = this.api.getResolvedRole();
  }

  loadTasks() {
    this.errorMessage = '';

    let request$: Observable<Task[]>;

    if (this.isManager) {
      request$ = this.taskService.getManagerTasks();
    } else if (this.isCollaborator) {
      request$ = this.taskService.getMyTasks();
    } else if (this.isAdmin) {
      request$ = this.taskService.getAllTasks();
    } else {
      this.errorMessage = 'Unknown user role.';
      this.tasks$ = of([]);
      return;
    }

    this.tasks$ = request$.pipe(
      map((tasks: Task[]) => {
        this.tasks = tasks;
        this.refreshGrouping();
        return tasks;
      }),
      catchError((err) => {
        this.errorMessage = 'Failed to load tasks. Please try again.';
        console.error('Failed to load tasks', err);
        this.tasks = [];
        this.refreshGrouping();
        return of([]);
      }),
      startWith(null)
    );
  }

  get activeStatus(): TaskStatus | null {
    return this.activeFilter === 'all' ? null : STATUS_CONFIG[this.activeFilter].status;
  }

  setFilter(key: TaskFilterKey) {
    this.activeFilter = key;
    this.refreshGrouping();
    this.cdr.detectChanges();
  }

  refreshGrouping() {
    const search = this.searchText?.trim().toLowerCase();

    const tasks = this.tasks.filter((task) => this.matchesFilter(task) && this.matchesSearch(task, search));
    this.filteredTasks = tasks;
    this.groupedTasks = this.buildGroupedTasks(tasks);
    this.updateFilterTabs();
  }

  matchesFilter(task: Task): boolean {
    return this.activeStatus === null || task.status === this.activeStatus;
  }

  matchesSearch(task: Task, search: string | null): boolean {
    if (!search) {
      return true;
    }

    const text = `${task.title} ${task.description} ${task.projectName ?? ''}`.toLowerCase();
    return text.includes(search);
  }

  countByStatus(status: TaskStatus) {
    return this.tasks.filter((t) => t.status === status).length;
  }

  getBadgeCount(filterKey: TaskFilterKey) {
    if (filterKey === 'all') {
      return this.tasks.length;
    }

    return this.countByStatus(STATUS_CONFIG[filterKey].status);
  }

  statusLabel(status: TaskStatus) {
    return STATUS_CONFIG[Object.keys(STATUS_CONFIG).find((k) => STATUS_CONFIG[k as Exclude<TaskFilterKey, 'all'>].status === status) as Exclude<TaskFilterKey, 'all'>]?.label ?? status;
  }

  priorityLabel(priority: Priority): string {
    switch (priority) {
      case Priority.LOW: return 'Low';
      case Priority.MEDIUM: return 'Medium';
      case Priority.HIGH: return 'High';
      default: return priority;
    }
  }

  getStatusClass(status: TaskStatus): string {
    return STATUS_CONFIG[Object.keys(STATUS_CONFIG).find((k) => STATUS_CONFIG[k as Exclude<TaskFilterKey, 'all'>].status === status) as Exclude<TaskFilterKey, 'all'>]?.className ?? '';
  }

  toggleSection(status: TaskStatus) {
    this.collapsedSections[status] = !this.collapsedSections[status];
    this.cdr.detectChanges();
  }

  selectTask(task: Task) {
    this.selectedTask = task;
    this.cdr.detectChanges();
  }

  closeTaskDetails() {
    this.selectedTask = null;
    this.cdr.detectChanges();
  }

  editTask(task: Task) {
    if (!this.canManageTasks) {
      return;
    }

    this.selectedTask = task;
    this.drawerErrorMessage = '';
    this.editForm = {
      title: task.title,
      description: task.description,
      collaboratorEmails: [...(task.collaboratorEmails ?? [])],
      priority: task.priority ?? null,
      deadline: task.deadline ?? null,
    };
    this.isEditDialogOpen = true;
    this.cdr.detectChanges();
  }

  deleteTask(task: Task) {
    if (!this.canManageTasks) {
      return;
    }

    if (confirm('Are you sure you want to delete this task?')) {
      this.taskService.deleteTask(task.id!).subscribe({
        next: () => this.loadTasks(),
        error: (err) => console.error('Failed to delete task', err),
      });
    }
  }

  closeEditDialog() {
    this.isEditDialogOpen = false;
    this.isSaving = false;
    this.drawerErrorMessage = '';
    this.selectedTask = null;
    this.editForm = { title: '', description: '', collaboratorEmails: [], priority: null, deadline: null };
    this.memberSearch = '';
    this.memberSuggestions = [];
    this.cdr.detectChanges();
  }

  updateTask() {
    if (!this.selectedTask) return;

    if (!this.editForm.title.trim()) {
      this.drawerErrorMessage = 'Task title is required.';
      this.cdr.detectChanges();
      return;
    }

    this.isSaving = true;
    this.drawerErrorMessage = '';
    this.cdr.detectChanges();

    this.taskService
      .updateTask(this.selectedTask.id!, {
        title: this.editForm.title.trim(),
        description: this.editForm.description.trim(),
        projectId: this.selectedTask.projectId,
        collaboratorEmails: this.editForm.collaboratorEmails,
        priority: this.editForm.priority ?? undefined,
        deadline: this.editForm.deadline ?? undefined,
      })
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.closeEditDialog();
          this.loadTasks();
        },
        error: (err) => {
          this.isSaving = false;
          this.drawerErrorMessage = err?.error?.error || 'Failed to update task. Please try again.';
          console.error('Failed to update task', err);
          this.cdr.detectChanges();
        },
      });
  }

  updateStatus(task: Task) {
    if (!this.isCollaborator) {
      return;
    }

    this.taskService.updateTaskStatus(task.id!, { status: task.status }).subscribe({
      next: () => this.loadTasks(),
      error: (err) => console.error('Failed to update status', err),
    });
  }

  searchMembers(event: { query?: string }) {
    if (!this.canManageTasks) {
      return;
    }

    const query = String(event?.query ?? '').trim().toLowerCase();

    if (!query) {
      this.memberSuggestions = [];
      this.cdr.detectChanges();
      return;
    }

    this.subscriptions.add(
      this.userService.searchCollaboratorEmails(query).subscribe({
        next: (emails) => {
          this.memberSuggestions = emails.filter((email) => !this.editForm.collaboratorEmails.includes(email));
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to search collaborators', err);
          this.memberSuggestions = [];
          this.cdr.detectChanges();
        },
      })
    );
  }

  addMemberEmail(email: string) {
    if (!this.editForm.collaboratorEmails.includes(email)) {
      this.editForm.collaboratorEmails.push(email);
    }

    this.memberSearch = '';
    this.memberSuggestions = [];
  }

  removeMemberEmail(email: string) {
    this.editForm.collaboratorEmails = this.editForm.collaboratorEmails.filter((entry) => entry !== email);
  }

  getInitialsFromEmail(email: string): string {
    const name = email.split('@')[0];
    return name.substring(0, 2).toUpperCase();
  }

  trackByFilter(_index: number, tab: FilterTab): TaskFilterKey {
    return tab.key;
  }

  trackByGroup(_index: number, group: GroupedTasks): TaskStatus {
    return group.status;
  }

  trackByTask(_index: number, task: Task): string | number | undefined {
    return task.id;
  }

  private buildGroupedTasks(tasks: Task[]): GroupedTasks[] {
    return GROUP_SECTION_ORDER.map((key) => {
      const cfg = STATUS_CONFIG[key];
      return {
        status: cfg.status,
        title: `${this.countByStatus(cfg.status)} ${cfg.titleSuffix}`,
        tasks: tasks.filter((task) => task.status === cfg.status),
      };
    });
  }

  private updateFilterTabs() {
    this.filterTabs = FILTER_TAB_CONFIG.map((tab) => ({
      ...tab,
      badge: this.getBadgeCount(tab.key),
    }));
  }
}
