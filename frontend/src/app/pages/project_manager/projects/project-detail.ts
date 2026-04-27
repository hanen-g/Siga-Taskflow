import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { ProjectService } from '../../../services/project.service';
import { Project } from '../../../models/project.model';
import { Priority, Task, TaskStatus } from '../../../models/task.model';
import { TaskService } from '../../../services/task.service';
import { UploadedFile } from '../../../models/uploaded-file.model';
import { FileAccessService } from '../../../services/file-access.service';
import { SkillService } from '../../../services/skill.service';
import { Skill, ProjectSkillMatchResult, UserSkillMatch } from '../../../models/skill.model';
import { MultiSelectModule } from 'primeng/multiselect';

type ProjectAction = 'edit' | 'delete' | 'add-task' | 'archive';

interface ProjectActionItem {
  action: ProjectAction;
  icon: string;
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
    FolderFileUploadComponent,
    MultiSelectModule
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
  activeTab: 'tasks' | 'files' | 'team' = 'tasks';

  allSkills: Skill[] = [];
  selectedRequiredSkillIds: number[] = [];
  teamMatchResult: ProjectSkillMatchResult | null = null;
  teamPanelLoading = false;
  savingRequiredSkills = false;
  skillsCatalogLoading = false;
  searchText = '';
  displayDialog = false;
  taskDialogVisible = false;
  isSavingProject = false;
  isSavingTask = false;
  readonly priorities: Priority[] = [Priority.LOW, Priority.MEDIUM, Priority.HIGH];
  editableProject: Pick<Project, 'name' | 'description'> = { name: '', description: '' };
  newTask: Task = this.createEmptyTask();

  backLink = '/dashboard/pm/projects';

  readonly projectActions: ProjectActionItem[] = [
    { action: 'edit', icon: 'pi pi-pencil', label: 'Edit project', tone: 'neutral' },
    { action: 'delete', icon: 'pi pi-trash', label: 'Delete project', tone: 'danger' },
    { action: 'add-task', icon: 'pi pi-plus', label: 'Add task', tone: 'success' },
    { action: 'archive', icon: 'pi pi-building-columns', label: 'Archive project', tone: 'warning' }
  ];

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

    return fullName || project?.managerEmail || 'Not available';
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
    private fileAccess: FileAccessService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private skillService: SkillService
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
      default:
        return status ?? 'Unknown';
    }
  }

  taskAssignee(task: Task | undefined): string {
    const email =
      task?.collaboratorEmails?.find(Boolean) ??
      task?.collaborators?.map((collaborator) => collaborator?.email).find(Boolean) ??
      task?.collaboratorEmail;

    return email || 'Unassigned';
  }

  switchTab(tab: 'tasks' | 'files' | 'team', project: Project | null): void {
    this.activeTab = tab;
    this.searchText = '';
    if (tab === 'team' && project?.id) {
      this.refreshTeamPanel(project);
    }
  }

  canEditProjectSkills(project: Project | null): boolean {
    if (!project) {
      return false;
    }
    const role = this.currentUserRole();
    const uid = this.readStoredUser()?.id;
    if (role === 'ADMIN') {
      return true;
    }
    if (role === 'PROJECT_MANAGER' && project.managerId != null && uid != null) {
      return project.managerId === uid;
    }
    return false;
  }

  saveProjectRequiredSkills(project: Project | null): void {
    if (!project?.id || !this.canEditProjectSkills(project)) {
      return;
    }
    this.savingRequiredSkills = true;
    this.projectService.setProjectRequiredSkills(project.id, this.selectedRequiredSkillIds).subscribe({
      next: () => {
        this.savingRequiredSkills = false;
        this.loadProject(project.id);
        this.reloadTeamMatches();
        this.messageService.add({
          severity: 'success',
          summary: 'Saved',
          detail: 'Required skills were updated.'
        });
      },
      error: (err) => {
        this.savingRequiredSkills = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.error ?? err.error?.message ?? 'Could not save required skills.'
        });
      }
    });
  }

  private refreshTeamPanel(project: Project): void {
    if (!this.projectId) {
      return;
    }
    this.selectedRequiredSkillIds = (project.requiredSkills ?? []).map((s) => s.id);
    this.loadSkillsCatalogIfNeeded(() => this.reloadTeamMatches());
  }

  private reloadTeamMatches(): void {
    if (!this.projectId) {
      return;
    }
    this.teamPanelLoading = true;
    this.projectService.getProjectSkillMatches(this.projectId).subscribe({
      next: (res) => {
        this.teamMatchResult = res;
        this.teamPanelLoading = false;
      },
      error: () => {
        this.teamMatchResult = null;
        this.teamPanelLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Could not load team matches.'
        });
      }
    });
  }

  private loadSkillsCatalogIfNeeded(done: () => void): void {
    if (this.allSkills.length > 0) {
      done();
      return;
    }
    this.skillsCatalogLoading = true;
    this.skillService.getAllSkills().subscribe({
      next: (skills) => {
        this.allSkills = skills;
        this.skillsCatalogLoading = false;
        done();
      },
      error: () => {
        this.skillsCatalogLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Could not load skills catalog.'
        });
        done();
      }
    });
  }

  matchRowLabel(m: UserSkillMatch): string {
    const parts = [m.firstName, m.lastName].filter(Boolean);
    return parts.length ? parts.join(' ') : m.email ?? 'User';
  }

  filteredTasks(project: Project | null): Task[] {
    const tasks = project?.tasks ?? [];
    const q = this.searchText.trim().toLowerCase();
    if (!q) {
      return tasks;
    }
    return tasks.filter((task) => {
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
    if (action.action === 'archive') {
      return project?.archived ? 'Unarchive project' : action.label;
    }
    return action.label;
  }

  canManageProject(project: Project | null): boolean {
    const role = this.currentUserRole();
    return !!project && (role === 'PROJECT_MANAGER' || role === 'ADMIN');
  }

  handleProjectAction(action: ProjectAction, project: Project | null, event: Event): void {
    if (!project || !this.canManageProject(project)) {
      return;
    }

    switch (action) {
      case 'edit':
        this.openEditProjectDialog(project);
        break;
      case 'delete':
        this.confirmDeleteProject(project, event);
        break;
      case 'add-task':
        this.openTaskDialog(project);
        break;
      case 'archive':
        this.confirmArchiveProject(project, event);
        break;
    }
  }

  openEditProjectDialog(project: Project): void {
    this.editableProject = {
      name: project.name ?? '',
      description: project.description ?? ''
    };
    this.displayDialog = true;
  }


  saveProject(project: Project): void {
    if (!project.id || this.isSavingProject || !this.validateProjectName(project)) {
      return;
    }

    this.isSavingProject = true;
    this.projectService.updateProject(project.id, this.editableProject).subscribe({
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

  openTaskDialog(project: Project): void {
    if (project.archived) {
      return;
    }
    this.newTask = this.createEmptyTask(project.id);
    this.taskDialogVisible = true;
  }

  closeTaskDialog(): void {
    this.taskDialogVisible = false;
    this.isSavingTask = false;
  }

  saveTask(project: Project): void {
    if (!project.id || this.isSavingTask || !this.newTask.title.trim()) {
      return;
    }

    this.isSavingTask = true;
    this.taskService.createTask({ ...this.newTask, projectId: project.id }).subscribe({
      next: () => {
        this.closeTaskDialog();
        this.newTask = this.createEmptyTask(project.id);
        this.loadProject(project.id);
        this.messageService.add({
          severity: 'success',
          summary: 'Task created',
          detail: 'The new task was added to this project.'
        });
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
          return '/dashboard/client/projects';
        }
      } catch {
        /* ignore */
      }
    }
    return '/dashboard/pm/projects';
  }

  canUploadAttachment(project: Project | null): boolean {
    const role = this.currentUserRole();
    return role === 'PROJECT_MANAGER' && !!project && !project.archived;
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
    const role = this.currentUserRole();
    if (role === 'PROJECT_MANAGER' || role === 'ADMIN') {
      return true;
    }
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

  private confirmDeleteProject(project: Project, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: 'Do you want to delete this project?',
      header: 'Delete Confirmation',
      icon: 'pi pi-info-circle',
      rejectButtonProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true
      },
      acceptButtonProps: {
        label: 'Delete',
        severity: 'danger'
      },
      accept: () => {
        this.projectService.deleteProject(project.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'info',
              summary: 'Deleted',
              detail: 'Project deleted successfully.'
            });
            void this.router.navigateByUrl(this.backLink);
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Delete failed',
              detail: 'Could not delete the project. Try again.'
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
              detail: `Project ${action.toLowerCase()}d successfully.`
            });
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: `${action} failed`,
              detail: `Could not ${action.toLowerCase()} this project. Try again.`
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
