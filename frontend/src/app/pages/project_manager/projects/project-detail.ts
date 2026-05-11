import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ConfirmationService, MessageService } from 'primeng/api';

import { AppLoaderComponent } from '../../../layout/app-loader';
import { FolderFileUploadComponent } from '../../../layout/folder-file-upload';
import { AssigneeCandidate, ProjectService } from '../../../services/project.service';
import { Project } from '../../../models/project.model';
import { Priority, Task, TaskStatus } from '../../../models/task.model';
import { TaskService } from '../../../services/task.service';
import { UploadedFile } from '../../../models/uploaded-file.model';
import { FileAccessService } from '../../../services/file-access.service';
import { MultiSelectModule } from 'primeng/multiselect';
import { AutoCompleteModule } from 'primeng/autocomplete';
import type { AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { UserService } from '../../../services/user.service';
import { TaskKanbanBoardComponent } from '../../tasks/components/task-kanban-board/task-kanban-board.component';
type ProjectAction =
  | 'edit'
  | 'add-task'
  | 'archive'
  | 'pause'
  | 'resume'
  | 'deliver'
  | 'reopen-delivery';

interface ProjectActionItem {
  action: ProjectAction;
  /** PrimeIcons class, when no custom `iconImg`. */
  icon?: string;
  /** Sidebar / hero PNG (same assets as menu). */
  iconImg?: string;
  label: string;
  tone: 'danger' | 'neutral' | 'success' | 'warning';
  disabled?: boolean;
  disabledReason?: string;
}

@Component({
  standalone: true,
  selector: 'app-project-detail-page',
  templateUrl: './project-detail.html',
  styleUrls: ['./project-detail.css'],
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    TagModule,
    AppLoaderComponent,
    MessageModule,
    ToastModule,
    ConfirmDialogModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    FolderFileUploadComponent,
    MultiSelectModule,
    AutoCompleteModule,
    TaskKanbanBoardComponent
  ],
  providers: [MessageService, ConfirmationService]
})
export class ProjectDetailPage implements OnInit {
  private readonly apiOrigin = 'http://localhost:8080';

  project$: Observable<Project | null> = of(null);
  projectId: number | null = null;
  error: string | null = null;
  uploadingAttachment = false;
  uploadingTaskFileIds = new Set<number>();
  activeTab: 'tasks' | 'files' = 'tasks';

  searchText = '';
  displayDialog = false;
  taskDialogVisible = false;
  editTaskDialogVisible = false;
  isSavingProject = false;
  isSavingTask = false;
  isUpdatingTask = false;
  readonly priorities: Priority[] = [Priority.LOW, Priority.MEDIUM, Priority.HIGH];
  editableProject: Pick<Project, 'name' | 'description' | 'startDate' | 'deadline'> = {
    name: '',
    description: '',
    startDate: '',
    deadline: ''
  };
  newTask: Task = this.createEmptyTask();
  editableTask: Task = this.createEmptyTask();
  editingTaskId: number | null = null;
  newTaskAttachmentFile: File | null = null;
  collaboratorEmailSuggestions: string[] = [];
  assigneeCandidates: AssigneeCandidate[] = [];
  assigneeCandidatesLoading = false;
  assigneeSuggestionsPopupVisible = false;
  assigneeSuggestionTarget: 'new' | 'edit' = 'new';
  private assigneeLoadSeq = 0;

  backLink = '/dashboard/pm/projects';

  /** Admin: lifecycle + edit. PM (owner): add task. */
  projectToolbarActions(project: Project | null): ProjectActionItem[] {
    if (!project) {
      return [];
    }
    const role = this.currentUserRole();
    const admin = role === 'ADMIN';
    const actions: ProjectActionItem[] = [];
    if (admin) {
      actions.push({ action: 'edit', icon: 'pi pi-pencil', label: 'Edit project', tone: 'neutral' });
      if (project.paused) {
        actions.push({ action: 'resume', icon: 'pi pi-play', label: 'Resume project', tone: 'success' });
      } else {
        actions.push({ action: 'pause', icon: 'pi pi-pause', label: 'Pause project', tone: 'warning' });
      }
      if (project.delivered) {
        actions.push({ action: 'reopen-delivery', icon: 'pi pi-replay', label: 'Reopen (not delivered)', tone: 'neutral' });
      } else {
        const readyForDelivery = this.isReadyForDelivery(project);
        actions.push({
          action: 'deliver',
          iconImg: 'assets/images/delivery-hero.png',
          label: 'Mark as delivered',
          tone: 'success',
          disabled: !readyForDelivery,
          disabledReason: 'Complete all project tasks before delivery'
        });
      }
      actions.push({
        action: 'archive',
        ...(project.archived
          ? { icon: 'pi pi-folder-open' as const }
          : { iconImg: 'assets/images/archived-hero.png' as const }),
        label: project.archived ? 'Unarchive project' : 'Archive project',
        tone: 'warning'
      });
    }
    if (
      this.isProjectManagerOfProject(project) &&
      !project.archived &&
      !project.paused &&
      !project.delivered
    ) {
      actions.push({ action: 'add-task', icon: 'pi pi-plus', label: 'Create new task', tone: 'success' });
    }
    return actions;
  }

  bannerColor(project: Project | null): string {
    if (!project) {
      return '#dbeafe';
    }
    const palette = [
      '#fecdd3',
      '#fde68a',
      '#bfdbfe',
      '#c7d2fe',
      '#bbf7d0',
      '#fbcfe8',
      '#fed7aa',
      '#a7f3d0'
    ];
    const seed = `${project.id ?? ''}${project.name ?? ''}`;
    const index =
      Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0) % palette.length;
    return palette[index];
  }

  completionPercent(project: Project | null): number {
    const tasks = project?.tasks ?? [];
    if (!tasks.length) {
      return 0;
    }

    const completed = tasks.filter((task) => task.status === 'DONE').length;
    return Math.round((completed / tasks.length) * 100);
  }

  deadlineDaysLeft(project: Project | null): number | null {
    const deadline = this.projectDateAtLocalMidnight(project?.deadline);
    if (!deadline) {
      return null;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((deadline.getTime() - today.getTime()) / 86_400_000);
  }

  deadlineBadgeLabel(project: Project | null): string | null {
    const daysLeft = this.deadlineDaysLeft(project);
    if (daysLeft == null) {
      return null;
    }
    if (daysLeft === 0) {
      return 'Due today';
    }
    if (daysLeft === 1) {
      return '1 day left';
    }
    if (daysLeft > 1) {
      return `${daysLeft} days left`;
    }
    const overdueDays = Math.abs(daysLeft);
    return overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`;
  }

  deadlineBadgeTone(project: Project | null): 'overdue' | 'today' | 'soon' | 'upcoming' {
    const daysLeft = this.deadlineDaysLeft(project);
    if (daysLeft == null || daysLeft > 7) {
      return 'upcoming';
    }
    if (daysLeft < 0) {
      return 'overdue';
    }
    if (daysLeft === 0) {
      return 'today';
    }
    return 'soon';
  }

  private projectDateAtLocalMidnight(raw: unknown): Date | null {
    if (raw == null || raw === '') {
      return null;
    }
    if (typeof raw === 'string') {
      const head = raw.length >= 10 ? raw.slice(0, 10) : raw;
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(head);
      if (match) {
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      }
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        parsed.setHours(0, 0, 0, 0);
        return parsed;
      }
    }
    if (Array.isArray(raw) && raw.length >= 3) {
      const [year, month, day] = raw.map(Number);
      if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
        return new Date(year, month - 1, day);
      }
    }
    return null;
  }

  createdOnLabel(project: Project | null): string {
    if (!project?.createdAt) {
      return 'Not available';
    }

    const parsed = new Date(project.createdAt);
    if (Number.isNaN(parsed.getTime())) {
      return 'Not available';
    }

    return parsed.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  projectManagerLabel(project: Project | null): string {
    const fullName = [project?.managerFirstName, project?.managerLastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return fullName || project?.managerEmail || 'Not available';
  }

  teamMembersLabel(project: Project | null): string {
    const count = this.uniqueCollaboratorEmails(project).length;
    return count === 1 ? '1 Member' : `${count || 0} Members`;
  }

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService,
    private taskService: TaskService,
    private fileAccess: FileAccessService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.backLink = this.resolveProjectsListUrl();
    const idParam = this.route.snapshot.paramMap.get('projectId');
    const id = idParam ? Number(idParam) : NaN;
    if (!Number.isFinite(id)) {
      this.error = 'Invalid project.';
      return;
    }
    this.projectId = id;
    this.error = null;
    this.project$ = this.projectService.getProject(id).pipe(
      catchError(() => {
        this.error = 'Unable to load this project or you do not have access.';
        return of(null);
      })
    );
  }

  resolveFileUrl(path?: string): string | null {
    if (!path) {
      return null;
    }
    if (path.startsWith('http')) {
      return path;
    }
    return path.startsWith('/') ? `${this.apiOrigin}${path}` : `${this.apiOrigin}/${path}`;
  }

  /**
   * File API requires JWT; opening a raw URL in a new tab does not send Authorization.
   * Fetch as blob (interceptor adds the token), then open in a new tab.
   */
  openFileInNewTab(event: Event, fileUrl: string): void {
    event.preventDefault();
    this.fileAccess.fetchFileBlob(fileUrl).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const win = window.open(objectUrl, '_blank', 'noopener,noreferrer');
        if (!win) {
          URL.revokeObjectURL(objectUrl);
          this.messageService.add({
            severity: 'warn',
            summary: 'Popup blocked',
            detail: 'Allow popups for this site to view the file, or try again.'
          });
          return;
        }
        setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Could not open file',
          detail: 'You may not have access, or your session expired. Try signing in again.'
        });
      }
    });
  }

  fileName(path?: string): string {
    if (!path) {
      return 'No file uploaded';
    }

    const normalizedPath = path.split('?')[0].split('#')[0];
    const storedName = normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1).trim();

    if (!storedName) {
      return 'Uploaded file';
    }

    const rawName = storedName.replace(/^[0-9a-fA-F-]{36}_/, '');

    if (!rawName) {
      return 'Uploaded file';
    }

    try {
      return decodeURIComponent(rawName);
    } catch {
      return rawName;
    }
  }

  uploadTimestampLabel(value?: string): string {
    if (!value) {
      return 'Unknown date';
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'Unknown date' : parsed.toLocaleString();
  }

  statusLabel(status?: string): string {
    switch (status) {
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'DONE':
        return 'Completed';
      case 'TODO':
        return 'To Do';
      case 'ON_HOLD':
        return 'On Hold';
      case 'IN_REVIEW':
        return 'In Review';
      default:
        return status ?? 'Unknown';
    }
  }

  /** CSS modifier for `.task-card-status` (list view badges). */
  taskStatusBadgeClass(status?: string): Record<string, boolean> {
    const s = String(status ?? '').toUpperCase();
    return {
      'is-todo': s === 'TODO',
      'is-progress': s === 'IN_PROGRESS',
      'is-hold': s === 'ON_HOLD',
      'is-review': s === 'IN_REVIEW',
      'is-done': s === 'DONE'
    };
  }

  taskAssignee(task: Task | undefined): string {
    const email =
      task?.collaboratorEmails?.find(Boolean) ??
      task?.collaborators?.map((collaborator) => collaborator?.email).find(Boolean) ??
      task?.collaboratorEmail;

    return email || 'Unassigned';
  }

  taskSkillIds(task: Task | undefined): number[] {
    return [...(task?.skillIds ?? []), ...(task?.skills?.map((skill) => skill.id).filter((id): id is number => id != null) ?? [])]
      .filter((id, index, ids) => ids.indexOf(id) === index);
  }

  switchTab(tab: 'tasks' | 'files'): void {
    this.activeTab = tab;
    this.searchText = '';
  }

  isAdminRole(): boolean {
    return this.currentUserRole() === 'ADMIN';
  }

  filteredTasks(project: Project | null): Task[] {
    const tasks = project?.tasks ?? [];
    const q = this.searchText.trim().toLowerCase();
    const filtered = !q
      ? [...tasks]
      : tasks.filter((task) => {
          const title = String(task.title ?? '').toLowerCase();
          const desc = String(task.description ?? '').toLowerCase();
          const assignee = this.taskAssignee(task).toLowerCase();
          const statusRaw = String(task.status ?? '').toLowerCase();
          const statusLabel = this.statusLabel(task.status).toLowerCase();
          return (
            title.includes(q) ||
            desc.includes(q) ||
            assignee.includes(q) ||
            statusRaw.includes(q) ||
            statusLabel.includes(q)
          );
        });
    return filtered.sort((a, b) => this.taskDisplayOrder(a.status) - this.taskDisplayOrder(b.status));
  }

  /** Rough workflow order for vertical list (active work first, done last). */
  private taskDisplayOrder(status: TaskStatus | string | undefined): number {
    const s = String(status ?? '').toUpperCase();
    if (s === TaskStatus.IN_PROGRESS) {
      return 0;
    }
    if (s === TaskStatus.IN_REVIEW) {
      return 1;
    }
    if (s === TaskStatus.ON_HOLD) {
      return 2;
    }
    if (s === TaskStatus.TODO) {
      return 3;
    }
    if (s === TaskStatus.DONE) {
      return 4;
    }
    return 9;
  }

  filteredProjectFiles(project: Project | null): UploadedFile[] {
    const files = this.sortedProjectFiles(project);
    const q = this.searchText.trim().toLowerCase();
    if (!q) {
      return files;
    }
    return files.filter((file) => {
      const name = String(file.originalFileName ?? '').toLowerCase();
      const context = this.fileContextLabel(file).toLowerCase();
      const by = String(file.uploadedByName ?? file.uploadedByEmail ?? '').toLowerCase();
      const fromUrl = this.fileName(file.fileUrl).toLowerCase();
      return name.includes(q) || context.includes(q) || by.includes(q) || fromUrl.includes(q);
    });
  }

  actionIconClass(action: ProjectActionItem): string {
    return `project-action-button project-action-${action.tone}`;
  }

  actionLabel(project: Project | null, action: ProjectActionItem): string {
    if (action.action === 'archive' && project) {
      return project.archived ? 'Unarchive project' : action.label;
    }
    if (action.disabled && action.disabledReason) {
      return `${action.label} - ${action.disabledReason}`;
    }
    return action.label;
  }

  private isReadyForDelivery(project: Project): boolean {
    if (typeof project.readyForDelivery === 'boolean') {
      return project.readyForDelivery;
    }
    const tasks = project.tasks ?? [];
    return tasks.length > 0 && tasks.every((task) => task.status === TaskStatus.DONE);
  }

  /**
   * True when the current user is the project manager for this project (not just any PM user).
   * Task creation and task file uploads use this; admins are read-only for tasks.
   */
  isProjectManagerOfProject(project: Project | null): boolean {
    if (!project) {
      return false;
    }
    const role = this.currentUserRole();
    if (role !== 'PROJECT_MANAGER') {
      return false;
    }
    const uid = this.readStoredUser()?.id;
    return project.managerId != null && uid != null && project.managerId === uid;
  }

  canEditTask(project: Project | null): boolean {
    return this.isProjectManagerOfProject(project) && !project?.archived && !project?.delivered;
  }

  handleProjectAction(action: ProjectAction, project: Project | null, event: Event): void {
    if (!project) {
      return;
    }
    if (action === 'add-task') {
      if (!this.isProjectManagerOfProject(project) || project.archived || project.paused || project.delivered) {
        return;
      }
    } else if (this.currentUserRole() !== 'ADMIN') {
      return;
    }
    const actionItem = this.projectToolbarActions(project).find((item) => item.action === action);
    if (actionItem?.disabled) {
      return;
    }

    switch (action) {
      case 'edit':
        this.openEditProjectDialog(project);
        break;
      case 'add-task':
        this.openTaskDialog(project);
        break;
      case 'archive':
        this.confirmArchiveProject(project, event);
        break;
      case 'pause':
        this.confirmSetPaused(project, true, event);
        break;
      case 'resume':
        this.confirmSetPaused(project, false, event);
        break;
      case 'deliver':
        this.confirmSetDelivered(project, true, event);
        break;
      case 'reopen-delivery':
        this.confirmSetDelivered(project, false, event);
        break;
    }
  }

  openEditProjectDialog(project: Project): void {
    this.editableProject = {
      name: project.name ?? '',
      description: project.description ?? '',
      startDate: project.startDate ?? '',
      deadline: project.deadline ?? ''
    };
    this.displayDialog = true;
  }


  saveProject(project: Project): void {
    if (!project.id || this.isSavingProject || !this.validateProjectName(project)) {
      return;
    }

    if (
      this.editableProject.startDate &&
      this.editableProject.deadline &&
      this.editableProject.startDate > this.editableProject.deadline
    ) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation',
        detail: 'Start date must be on or before the deadline.'
      });
      return;
    }

    this.isSavingProject = true;
    this.projectService
      .updateProject(project.id, {
        name: this.editableProject.name,
        description: this.editableProject.description,
        startDate: this.editableProject.startDate || undefined,
        deadline: this.editableProject.deadline || undefined
      })
      .subscribe({
      next: () => {
        this.displayDialog = false;
        this.loadProject(project.id);
        this.messageService.add({
          severity: 'success',
          summary: 'Updated',
          detail: 'Project updated successfully.'
        });
      },
      error: () => {
        this.isSavingProject = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Update failed',
          detail: 'Could not update the project. Try again.'
        });
      }
    });
  }

  onNewTaskFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.newTaskAttachmentFile = input.files?.[0] ?? null;
  }

  loadAssigneeSuggestions(project: Project | null): void {
    if (!project?.id || !this.isProjectManagerOfProject(project)) {
      this.assigneeCandidates = [];
      this.assigneeCandidatesLoading = false;
      return;
    }
    const seq = ++this.assigneeLoadSeq;
    this.assigneeCandidatesLoading = true;
    const ids = [...(this.newTask.skillIds ?? [])].filter((id): id is number => id != null);
    this.projectService.getAssigneeCandidates(project.id, ids).subscribe({
      next: (rows) => {
        if (seq !== this.assigneeLoadSeq) {
          return;
        }
        this.assigneeCandidates = rows;
        this.assigneeCandidatesLoading = false;
      },
      error: () => {
        if (seq !== this.assigneeLoadSeq) {
          return;
        }
        this.assigneeCandidates = [];
        this.assigneeCandidatesLoading = false;
      }
    });
  }

  loadEditAssigneeSuggestions(project: Project | null): void {
    if (!project?.id || !this.isProjectManagerOfProject(project)) {
      this.assigneeCandidates = [];
      this.assigneeCandidatesLoading = false;
      return;
    }
    const seq = ++this.assigneeLoadSeq;
    this.assigneeCandidatesLoading = true;
    const ids = [...(this.editableTask.skillIds ?? [])].filter((id): id is number => id != null);
    this.projectService.getAssigneeCandidates(project.id, ids).subscribe({
      next: (rows) => {
        if (seq !== this.assigneeLoadSeq) {
          return;
        }
        this.assigneeCandidates = rows;
        this.assigneeCandidatesLoading = false;
      },
      error: () => {
        if (seq !== this.assigneeLoadSeq) {
          return;
        }
        this.assigneeCandidates = [];
        this.assigneeCandidatesLoading = false;
      }
    });
  }

  onNewTaskSkillsChange(project: Project | null): void {
    this.loadAssigneeSuggestions(project);
  }

  onEditTaskSkillsChange(project: Project | null): void {
    this.loadEditAssigneeSuggestions(project);
  }

  pickAssignee(email: string): void {
    const trimmed = email?.trim();
    if (trimmed) {
      this.newTask.collaboratorEmail = trimmed;
    }
  }

  openAssigneeSuggestionsPopup(target: 'new' | 'edit' = 'new'): void {
    this.assigneeSuggestionTarget = target;
    this.assigneeSuggestionsPopupVisible = true;
  }

  pickAssigneeFromPopup(email: string): void {
    if (this.assigneeSuggestionTarget === 'edit') {
      this.editableTask.collaboratorEmail = email?.trim() ?? '';
    } else {
      this.pickAssignee(email);
    }
    this.assigneeSuggestionsPopupVisible = false;
  }

  formatAssigneeRow(c: AssigneeCandidate): string {
    const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
    const label = name ? `${name} <${c.email}>` : c.email;
    const n = c.activeTaskCount ?? 0;
    const suffix = n === 1 ? '1 active task' : `${n} active tasks`;
    return `${label} — ${suffix}`;
  }

  searchCollaborators(event: AutoCompleteCompleteEvent): void {
    const q = event.query ?? '';
    this.userService.searchCollaboratorEmails(q).subscribe({
      next: (emails) => {
        this.collaboratorEmailSuggestions = this.mergeAssigneeSuggestionsForPm(emails, q);
      },
      error: () => {
        this.collaboratorEmailSuggestions = [];
      }
    });
  }

  /**
   * Ensures the signed-in project manager can pick their own email (API list is capped and sorted globally).
   */
  private mergeAssigneeSuggestionsForPm(apiEmails: string[], queryRaw: string): string[] {
    const unique = [...new Set(apiEmails.map((e) => e.trim()).filter((e) => e.length > 0))];
    unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    const me = this.readStoredUser()?.email?.trim();
    if (this.currentUserRole() !== 'PROJECT_MANAGER' || !me) {
      return unique;
    }
    const q = queryRaw.trim().toLowerCase();
    const meLower = me.toLowerCase();
    if (q && !meLower.includes(q)) {
      return unique;
    }
    const rest = unique.filter((e) => e.toLowerCase() !== meLower);
    return [me, ...rest];
  }

  /** Set new task assignee to the current user (project manager). */
  assignNewTaskToMe(): void {
    const email = this.readStoredUser()?.email?.trim();
    if (!email) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Could not assign',
        detail: 'Your account email was not found. Try typing it in the assignee field.'
      });
      return;
    }
    if (this.currentUserRole() !== 'PROJECT_MANAGER') {
      return;
    }
    this.newTask.collaboratorEmail = email;
  }

  openTaskDialog(project: Project): void {
    if (project.archived || project.paused || project.delivered || !this.isProjectManagerOfProject(project)) {
      return;
    }
    this.newTask = this.createEmptyTask(project.id);
    this.newTaskAttachmentFile = null;
    this.collaboratorEmailSuggestions = [];
    this.assigneeCandidates = [];
    this.taskDialogVisible = true;
    this.loadAssigneeSuggestions(project);
  }

  closeTaskDialog(): void {
    this.taskDialogVisible = false;
    this.isSavingTask = false;
    this.newTaskAttachmentFile = null;
    this.collaboratorEmailSuggestions = [];
    this.assigneeCandidates = [];
    this.assigneeCandidatesLoading = false;
    this.assigneeSuggestionsPopupVisible = false;
    this.assigneeLoadSeq++;
  }

  saveTask(project: Project): void {
    if (!project.id || this.isSavingTask || !this.newTask.title.trim() || !this.isProjectManagerOfProject(project)) {
      return;
    }

    this.isSavingTask = true;
    const attachment = this.newTaskAttachmentFile;
    this.taskService.createTask({ ...this.newTask, projectId: project.id }).subscribe({
      next: (created) => {
        const taskId = created?.id;
        if (attachment && taskId != null) {
          this.taskService.uploadTaskFile(taskId, attachment).subscribe({
            next: () => this.afterTaskCreatedSuccess(project, false),
            error: () => this.afterTaskCreatedSuccess(project, true)
          });
          return;
        }
        this.afterTaskCreatedSuccess(project, false);
      },
      error: () => {
        this.isSavingTask = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Creation failed',
          detail: 'Could not create the task. Try again.'
        });
      }
    });
  }

  private afterTaskCreatedSuccess(project: Project, attachmentUploadFailed: boolean): void {
    this.isSavingTask = false;
    this.newTaskAttachmentFile = null;
    this.closeTaskDialog();
    this.newTask = this.createEmptyTask(project.id);
    this.loadProject(project.id);
    if (attachmentUploadFailed) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Task created',
        detail: 'The task was added, but the attachment could not be uploaded. Try adding a file from the task row.'
      });
    } else {
      this.messageService.add({
        severity: 'success',
        summary: 'Task created',
        detail: 'The new task was added to this project.'
      });
    }
  }

  openEditTaskDialog(task: Task, project: Project): void {
    if (!task.id || !this.canEditTask(project)) {
      return;
    }
    this.editingTaskId = task.id;
    this.editableTask = {
      ...this.createEmptyTask(project.id),
      ...task,
      projectId: project.id,
      collaboratorEmail: this.taskAssignee(task) === 'Unassigned' ? '' : this.taskAssignee(task),
      skillIds: this.taskSkillIds(task)
    };
    this.collaboratorEmailSuggestions = [];
    this.editTaskDialogVisible = true;
    this.loadEditAssigneeSuggestions(project);
  }

  closeEditTaskDialog(): void {
    this.editTaskDialogVisible = false;
    this.isUpdatingTask = false;
    this.editingTaskId = null;
    this.editableTask = this.createEmptyTask();
    this.collaboratorEmailSuggestions = [];
  }

  saveEditedTask(project: Project): void {
    if (
      !project.id ||
      !this.editingTaskId ||
      this.isUpdatingTask ||
      !this.editableTask.title.trim() ||
      !this.canEditTask(project)
    ) {
      return;
    }

    this.isUpdatingTask = true;
    this.taskService
      .updateTask(this.editingTaskId, {
        projectId: project.id,
        title: this.editableTask.title.trim(),
        description: this.editableTask.description ?? '',
        status: this.editableTask.status,
        priority: this.editableTask.priority,
        deadline: this.editableTask.deadline,
        collaboratorEmail: this.editableTask.collaboratorEmail?.trim() ?? '',
        skillIds: this.editableTask.skillIds ?? []
      })
      .subscribe({
        next: () => {
          this.isUpdatingTask = false;
          this.closeEditTaskDialog();
          this.loadProject(project.id);
          this.messageService.add({
            severity: 'success',
            summary: 'Task updated',
            detail: 'The task was updated successfully.'
          });
        },
        error: () => {
          this.isUpdatingTask = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Update failed',
            detail: 'Could not update the task. Try again.'
          });
        }
      });
  }

  assignEditedTaskToMe(): void {
    const email = this.readStoredUser()?.email?.trim();
    if (!email || this.currentUserRole() !== 'PROJECT_MANAGER') {
      return;
    }
    this.editableTask.collaboratorEmail = email;
  }

  canMarkTaskDone(task: Task | undefined, project: Project | null): boolean {
    return (
      !!task?.id &&
      this.isProjectManagerOfProject(project) &&
      !project?.archived &&
      !project?.delivered &&
      task.status === TaskStatus.IN_REVIEW
    );
  }

  markTaskDone(task: Task | undefined, project: Project | null): void {
    if (!task?.id || !project?.id || !this.canMarkTaskDone(task, project)) {
      return;
    }
    this.taskService.updateTaskStatus(task.id, { status: TaskStatus.DONE }).subscribe({
      next: () => {
        this.loadProject(project.id!);
        this.messageService.add({
          severity: 'success',
          summary: 'Task completed',
          detail: `Task "${task.title}" was marked as done.`
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Update failed',
          detail: 'Could not mark this task as done. Try again.'
        });
      }
    });
  }

  private resolveProjectsListUrl(): string {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const role = JSON.parse(userData)?.role;
        if (role === 'ADMIN') {
          return '/dashboard/admin/projects';
        }
        if (role === 'COLLABORATOR') {
          return '/dashboard/collab/projects';
        }
        if (role === 'CLIENT') {
          return '/dashboard/client';
        }
      } catch {
        /* ignore */
      }
    }
    return '/dashboard/pm/projects';
  }

  canUploadAttachment(project: Project | null): boolean {
    const role = this.currentUserRole();
    if (!project || project.archived) {
      return false;
    }
    if (role === 'ADMIN') {
      return true;
    }
    return role === 'PROJECT_MANAGER';
  }

  onAttachmentFile(file: File, project: Project | null) {
    if (!project?.id || this.uploadingAttachment) {
      return;
    }
    this.uploadingAttachment = true;
    this.projectService.uploadAttachment(project.id, file).subscribe({
      next: () => {
        this.loadProject(project.id);
        this.uploadingAttachment = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Uploaded',
          detail: 'Project file uploaded successfully.'
        });
      },
      error: () => {
        this.uploadingAttachment = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Upload failed',
          detail: 'Could not upload the file. Try again or check your permissions.'
        });
      }
    });
  }

  canUploadTaskFile(task: Task | undefined, project: Project | null): boolean {
    if (!task?.id || !project || project.archived) {
      return false;
    }
    if (this.isProjectManagerOfProject(project)) {
      return true;
    }
    const role = this.currentUserRole();
    if (role !== 'COLLABORATOR') {
      return false;
    }
    const currentEmail = this.readStoredUser()?.email;
    if (!currentEmail) {
      return false;
    }
    const assignees = new Set<string>([
      ...(task.collaboratorEmails ?? []).map((email) => (email ?? '').trim().toLowerCase()),
      ...(task.collaborators?.map((c) => (c?.email ?? '').trim().toLowerCase()) ?? []),
      (task.collaboratorEmail ?? '').trim().toLowerCase()
    ]);
    return assignees.has(currentEmail.trim().toLowerCase());
  }

  isUploadingTaskFile(taskId?: number): boolean {
    return !!taskId && this.uploadingTaskFileIds.has(taskId);
  }

  openTaskFilePicker(taskId?: number): void {
    if (!taskId) {
      return;
    }
    document.getElementById(`task-upload-${taskId}`)?.click();
  }

  onTaskFileInputChange(event: Event, task: Task, project: Project | null): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.onTaskAttachmentFile(file, task, project);
    }
  }

  onTaskAttachmentFile(file: File, task: Task | undefined, project: Project | null): void {
    if (!task?.id || !project?.id || this.uploadingTaskFileIds.has(task.id)) {
      return;
    }
    this.uploadingTaskFileIds.add(task.id);
    this.taskService.uploadTaskFile(task.id, file).subscribe({
      next: () => {
        this.uploadingTaskFileIds.delete(task.id!);
        this.loadProject(project.id!);
        this.messageService.add({
          severity: 'success',
          summary: 'Uploaded',
          detail: `File uploaded to task "${task.title}".`
        });
      },
      error: () => {
        this.uploadingTaskFileIds.delete(task.id!);
        this.messageService.add({
          severity: 'error',
          summary: 'Upload failed',
          detail: 'Could not upload the task file. Check your permissions and try again.'
        });
      }
    });
  }

  sortedProjectFiles(project: Project | null): UploadedFile[] {
    const list = [...(project?.files ?? [])];
    return list.sort((a, b) => {
      const ta = new Date(a.uploadedAt ?? 0).getTime();
      const tb = new Date(b.uploadedAt ?? 0).getTime();
      return tb - ta;
    });
  }

  fileContextLabel(file: UploadedFile): string {
    if (file.scope === 'TASK') {
      const title = file.taskTitle?.trim();
      return title ? `Task: ${title}` : 'Task file';
    }
    return 'Project';
  }

  priorityLabel(priority: Priority): string {
    switch (priority) {
      case Priority.LOW:
        return 'Low';
      case Priority.MEDIUM:
        return 'Medium';
      case Priority.HIGH:
        return 'High';
      case Priority.URGENT:
        return 'Urgent';
      default:
        return priority;
    }
  }

  private uniqueCollaboratorEmails(project: Project | null): string[] {
    const emails = (project?.tasks ?? [])
      .flatMap((task) => [
        ...(task.collaboratorEmails ?? []),
        ...(task.collaborators?.map((collaborator) => collaborator?.email ?? '') ?? []),
        task.collaboratorEmail ?? ''
      ])
      .map((email) => email.trim())
      .filter(Boolean);

    return [...new Set(emails)];
  }

  private readStoredUser(): { id?: number; firstName?: string; lastName?: string; role?: string; email?: string } | null {
    const userData = localStorage.getItem('user');
    if (!userData) {
      return null;
    }

    try {
      return JSON.parse(userData);
    } catch {
      return null;
    }
  }

  /** Client portal: read-only progress and shared files. */
  isClientPortal(): boolean {
    return this.currentUserRole() === 'CLIENT';
  }

  private currentUserRole(): string | null {
    const storedUser = this.readStoredUser();
    if (storedUser?.role) {
      return storedUser.role;
    }
    const token = localStorage.getItem('token');
    if (token) {
      try {
        return JSON.parse(atob(token.split('.')[1]))?.role ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }

  private loadProject(id: number): void {
    this.error = null;
    this.project$ = this.projectService.getProject(id).pipe(
      catchError(() => {
        this.error = 'Unable to load this project or you do not have access.';
        return of(null);
      })
    );
  }

  private validateProjectName(project: Project): boolean {
    const name = this.editableProject.name?.trim();
    if (!name) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Project name cannot be empty.'
      });
      return false;
    }

    const currentName = project.name?.trim().toLowerCase();
    if (name.toLowerCase() === currentName) {
      return true;
    }

    return true;
  }

  private projectConfirmPhrase(project: Project | null): string {
    const n = project?.name?.trim() ?? '';
    return n ? `the project “${n}”` : 'this project';
  }

  private confirmSetPaused(project: Project, paused: boolean, event: Event): void {
    const action = paused ? 'Pause' : 'Resume';
    const phrase = this.projectConfirmPhrase(project);
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: paused
        ? `Are you sure you want to pause ${phrase}? The team can still view it.`
        : `Are you sure you want to resume ${phrase} and clear the paused state?`,
      header: `${action} project`,
      icon: 'pi pi-info-circle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: action, severity: 'warning' },
      accept: () => {
        this.projectService.setProjectLifecycle(project.id, { paused }).subscribe({
          next: () => {
            this.loadProject(project.id);
            this.messageService.add({ severity: 'success', summary: 'Updated', detail: `Project ${action.toLowerCase()}d.` });
          },
          error: (err) => {
            const m = err?.error?.message ?? err?.error?.error;
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: typeof m === 'string' ? m : 'Could not update the project.'
            });
          }
        });
      }
    });
  }

  private confirmSetDelivered(project: Project, delivered: boolean, event: Event): void {
    const action = delivered ? 'Mark as delivered' : 'Reopen';
    const phrase = this.projectConfirmPhrase(project);
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: delivered
        ? `Are you sure you want to deliver ${phrase} (mark it as closed)?`
        : `Are you sure you want to reopen ${phrase} and clear the delivered state?`,
      header: action,
      icon: 'pi pi-info-circle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: action, severity: 'success' },
      accept: () => {
        this.projectService.setProjectLifecycle(project.id, { delivered }).subscribe({
          next: () => {
            this.loadProject(project.id);
            this.messageService.add({ severity: 'success', summary: 'Updated', detail: 'Project status was updated.' });
          },
          error: (err) => {
            const m = err?.error?.message ?? err?.error?.error;
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: typeof m === 'string' ? m : 'Could not update the project.'
            });
          }
        });
      }
    });
  }

  private confirmArchiveProject(project: Project, event: Event): void {
    const archived = !project.archived;
    const action = archived ? 'Archive' : 'Unarchive';
    const phrase = this.projectConfirmPhrase(project);
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Are you sure you want to ${action.toLowerCase()} ${phrase}?`,
      header: `${action} Confirmation`,
      icon: 'pi pi-info-circle',
      rejectButtonProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true
      },
      acceptButtonProps: {
        label: action,
        severity: 'warning'
      },
      accept: () => {
        this.projectService.archiveProject(project.id, archived).subscribe({
          next: () => {
            this.loadProject(project.id);
            this.messageService.add({
              severity: 'info',
              summary: `${action}d`,
              detail: archived
                ? 'Project archived. It no longer appears in the main list; open Archived projects to find it.'
                : 'Project unarchived successfully.'
            });
          },
          error: (err) => {
            const m = err?.error?.message ?? err?.error?.error;
            this.messageService.add({
              severity: 'error',
              summary: `${action} failed`,
              detail:
                typeof m === 'string'
                  ? m
                  : `Could not ${action.toLowerCase()} this project. Try again.`
            });
          }
        });
      }
    });
  }

  private createEmptyTask(projectId = this.projectId ?? 0): Task {
    return {
      title: '',
      description: '',
      status: TaskStatus.TODO,
      priority: undefined,
      deadline: undefined,
      collaboratorEmail: '',
      skillIds: [],
      projectId
    };
  }
}
