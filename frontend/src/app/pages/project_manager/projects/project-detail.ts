import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { ConfirmationService, MessageService } from 'primeng/api';

import { AppLoaderComponent } from '../../../layout/app-loader';
import { FolderFileUploadComponent } from '../../../layout/folder-file-upload';
import { ProjectService } from '../../../services/project.service';
import { Project } from '../../../models/project.model';
import { Priority, Task, TaskStatus } from '../../../models/task.model';
import { TaskService } from '../../../services/task.service';
import { UploadedFile } from '../../../models/uploaded-file.model';
import { FileAccessService } from '../../../services/file-access.service';
import { TaskKanbanBoardComponent } from '../../tasks/components/task-kanban-board/task-kanban-board.component';
import {
  AdminUser,
  CollaboratorDirectoryEntry,
  ProjectManagerOption,
  UserService
} from '../../../services/user.service';
import { SkillService } from '../../../services/skill.service';
import { Skill } from '../../../models/skill.model';

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
    SelectModule,
    MultiSelectModule,
    FolderFileUploadComponent,
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
  displayDialog = false;
  taskDialogVisible = false;
  isSavingProject = false;
  isSavingTask = false;
  readonly priorities: Priority[] = [Priority.LOW, Priority.MEDIUM, Priority.HIGH];
  editableProject: {
    name: string;
    description: string;
    startDate: string;
    deadline: string;
    managerId: number | null;
    clientIds: number[];
    requiredSkillIds: number[];
  } = {
    name: '',
    description: '',
    startDate: '',
    deadline: '',
    managerId: null,
    clientIds: [],
    requiredSkillIds: []
  };
  /** Admin edit staffing */
  projectManagers: ProjectManagerOption[] = [];
  activeClientsForProject: AdminUser[] = [];
  clientSelectOptions: { label: string; value: number }[] = [];
  allSkills: Skill[] = [];
  skillsLoading = false;
  newTask: Task = this.createEmptyTask();
  collaboratorDirectory: CollaboratorDirectoryEntry[] = [];
  collaboratorsLoading = false;
  /** When the directory is loaded: overrides the dropdown if filled. */
  collaboratorEmailManual = '';

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
        actions.push({
          action: 'deliver',
          iconImg: 'assets/images/delivery-hero.png',
          label: 'Mark as delivered',
          tone: 'success'
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
      actions.push({ action: 'add-task', icon: 'pi pi-plus', label: 'Add task', tone: 'success' });
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

    return fullName || project?.managerEmail || '—';
  }

  /** Client accounts linked to the project (role CLIENT on members). */
  clientNamesLabel(project: Project | null): string {
    const names = (project?.clientNames ?? []).map((n) => String(n).trim()).filter(Boolean);
    if (!names.length) {
      return '—';
    }
    return names.join(', ');
  }

  teamMembersLabel(project: Project | null): string {
    const count = this.uniqueCollaboratorEmails(project).length;
    return count === 1 ? '1 Member' : `${count || 0} Members`;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private taskService: TaskService,
    private userService: UserService,
    private skillService: SkillService,
    private fileAccess: FileAccessService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
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

  switchTab(tab: 'tasks' | 'files'): void {
    this.activeTab = tab;
  }

  actionIconClass(action: ProjectActionItem): string {
    return `project-action-button project-action-${action.tone}`;
  }

  actionLabel(project: Project | null, action: ProjectActionItem): string {
    if (action.action === 'archive' && project) {
      return project.archived ? 'Unarchive project' : action.label;
    }
    return action.label;
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
    if (!project.id) {
      return;
    }
    this.loadSkillsIfNeeded();
    forkJoin({
      detail: this.projectService.getProject(project.id),
      pms: this.userService.getProjectManagersForAdmin(),
      clients: this.userService.getAdminUsers('', 'CLIENT', 'active')
    }).subscribe({
      next: ({ detail, pms, clients }) => {
        this.projectManagers = pms ?? [];
        this.activeClientsForProject = clients ?? [];
        this.rebuildClientSelectOptionsDetail();
        this.editableProject = {
          name: detail?.name ?? '',
          description: detail?.description ?? '',
          startDate: detail?.startDate ?? '',
          deadline: detail?.deadline ?? '',
          managerId: detail?.managerId ?? null,
          clientIds: [...(detail?.clientIds ?? [])],
          requiredSkillIds: (detail?.requiredSkills ?? []).map((s: Skill) => s.id)
        };
        this.displayDialog = true;
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Could not load project for editing.'
        });
      }
    });
  }

  projectManagerSelectOptionsDetail(): { label: string; value: number }[] {
    return (this.projectManagers ?? []).map((u) => ({
      label: `${u.firstName ?? ''} ${u.lastName ?? ''} (${u.email})`.replace(/^\s+|\s+$/g, ''),
      value: u.id
    }));
  }

  private rebuildClientSelectOptionsDetail(): void {
    this.clientSelectOptions = this.activeClientsForProject.map((c) => {
      const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
      return {
        label: name ? `${name} (${c.email})` : c.email,
        value: c.id
      };
    });
  }

  private loadSkillsIfNeeded(): void {
    if (this.allSkills.length > 0 || this.skillsLoading) {
      return;
    }
    this.skillsLoading = true;
    this.skillService.getAllSkills().subscribe({
      next: (skills) => {
        this.allSkills = skills ?? [];
        this.skillsLoading = false;
      },
      error: () => {
        this.skillsLoading = false;
        this.messageService.add({
          severity: 'warn',
          summary: 'Skills',
          detail: 'Could not load the skills catalog.'
        });
      }
    });
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

    if (this.currentUserRole() === 'ADMIN') {
      if (this.editableProject.managerId == null) {
        this.messageService.add({
          severity: 'error',
          summary: 'Validation',
          detail: 'Select a project manager.'
        });
        return;
      }
    }

    const clientIdsNorm =
      this.currentUserRole() === 'ADMIN'
        ? (this.editableProject.clientIds ?? [])
            .map((id) => Number(id))
            .filter((n) => Number.isFinite(n) && n > 0)
        : [];

    this.isSavingProject = true;
    const mid =
      this.editableProject.managerId != null ? Number(this.editableProject.managerId) : NaN;
    const skillPayload = (this.editableProject.requiredSkillIds ?? []).map((id) => ({
      id: Number(id)
    }));

    this.projectService
      .updateProject(project.id, {
        name: this.editableProject.name,
        description: this.editableProject.description,
        startDate: this.editableProject.startDate || undefined,
        deadline: this.editableProject.deadline || undefined,
        requiredSkills: skillPayload,
        ...(this.currentUserRole() === 'ADMIN' && Number.isFinite(mid)
          ? {
              manager: { id: mid },
              clientIds: clientIdsNorm
            }
          : {})
      })
      .pipe(finalize(() => (this.isSavingProject = false)))
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
        error: (err) => {
          const m = this.httpErrorDetail(err);
          this.messageService.add({
            severity: 'error',
            summary: 'Update failed',
            detail: m ?? 'Could not update the project. Try again.'
          });
        }
      });
  }

  private httpErrorDetail(err: unknown): string | null {
    const anyErr = err as { error?: unknown; status?: number; message?: string } | null;
    const body = anyErr?.error;
    if (typeof body === 'string' && body.trim()) {
      return body.trim();
    }
    if (body && typeof body === 'object') {
      const o = body as { message?: string; error?: string };
      const m = o.message ?? o.error;
      if (typeof m === 'string' && m.trim()) {
        return m.trim();
      }
    }
    if (typeof anyErr?.message === 'string' && anyErr.message.trim()) {
      return anyErr.message.trim();
    }
    return null;
  }

  openTaskDialog(project: Project): void {
    if (project.archived || project.paused || project.delivered || !this.isProjectManagerOfProject(project)) {
      return;
    }
    this.newTask = this.createEmptyTask(project.id);
    this.collaboratorEmailManual = '';
    this.taskDialogVisible = true;
    this.loadCollaboratorDirectory();
  }

  collaboratorLabel(entry: CollaboratorDirectoryEntry): string {
    const name = `${entry.firstName ?? ''} ${entry.lastName ?? ''}`.trim();
    return name ? `${name} — ${entry.email}` : entry.email;
  }

  private loadCollaboratorDirectory(): void {
    this.collaboratorsLoading = true;
    this.userService.getCollaboratorDirectory().subscribe({
      next: (list) => {
        this.collaboratorDirectory = list ?? [];
        this.collaboratorsLoading = false;
      },
      error: () => {
        this.collaboratorDirectory = [];
        this.collaboratorsLoading = false;
        this.messageService.add({
          severity: 'warn',
          summary: 'Collaborator list',
          detail: 'Could not load collaborators. Ask an administrator to check your access.'
        });
      }
    });
  }

  closeTaskDialog(): void {
    this.taskDialogVisible = false;
    this.isSavingTask = false;
    this.collaboratorEmailManual = '';
  }

  saveTask(project: Project): void {
    if (!project.id || this.isSavingTask || !this.newTask.title.trim() || !this.isProjectManagerOfProject(project)) {
      return;
    }
    const collabEmail =
      this.collaboratorEmailManual.trim() || this.newTask.collaboratorEmail?.trim() || '';
    if (!collabEmail) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Collaborator required',
        detail: 'Select a collaborator in the list or enter their email.'
      });
      return;
    }

    this.isSavingTask = true;
    this.taskService
      .createTask({
        title: this.newTask.title.trim(),
        description: this.newTask.description?.trim() ?? '',
        status: TaskStatus.TODO,
        projectId: project.id,
        collaboratorEmail: collabEmail,
        priority: this.newTask.priority,
        deadline: this.newTask.deadline
      })
      .subscribe({
      next: () => {
        this.collaboratorEmailManual = '';
        this.closeTaskDialog();
        this.newTask = this.createEmptyTask(project.id);
        this.loadProject(project.id);
        this.messageService.add({
          severity: 'success',
          summary: 'Task created',
          detail: 'The new task was added to this project.'
        });
      },
      error: (err) => {
        this.isSavingTask = false;
        const m = err?.error?.message ?? err?.error?.error;
        this.messageService.add({
          severity: 'error',
          summary: 'Creation failed',
          detail:
            typeof m === 'string' && m.trim()
              ? m
              : 'Could not create the task. Try again.'
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

  /** Client portal: read-only progress and shared files; no internal team/skills UI. */
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

  private confirmSetPaused(project: Project, paused: boolean, event: Event): void {
    const action = paused ? 'Pause' : 'Resume';
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: paused
        ? 'Pause this project? The team can still view it.'
        : 'Resume this project and clear the paused state?',
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
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: delivered
        ? 'Mark this project as delivered (closed)?'
        : 'Reopen this project and clear the delivered state?',
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
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Do you want to ${action.toLowerCase()} this project?`,
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
                ? 'Project archived. It no longer appears in the main list — open Archived projects in the menu to find it.'
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
      projectId
    };
  }
}
