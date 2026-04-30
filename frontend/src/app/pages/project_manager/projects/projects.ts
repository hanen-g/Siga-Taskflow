import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject, of } from 'rxjs';
import { catchError, switchMap, startWith, tap } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { TextareaModule } from 'primeng/textarea';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';

import { ProjectService } from '../../../services/project.service';
import { UserService, ProjectManagerOption } from '../../../services/user.service';
import { WebsocketService } from '../../../services/websocket.service';
import { ApiService } from '../../../services/api';
import { ProjectPanel } from './project-panel';
import { AppLoaderComponent } from '../../../layout/app-loader';
import { Skill } from '../../../models/skill.model';
import { SkillService } from '../../../services/skill.service';

@Component({
  standalone: true,
  selector: 'app-projects-page',
  templateUrl: './projects.html',
  styleUrls: ['./projects.css'],
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MessageModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MenuModule,
    ProjectPanel,
    AppLoaderComponent,
    TextareaModule,
    ConfirmDialogModule,
    ToastModule,
    SelectModule,
    MultiSelectModule
  ],
  providers: [ConfirmationService, MessageService]
})
export class ProjectsPage implements OnInit {

  role: string | null = null;
  pageTitle = 'Projects';

  private refresh$ = new Subject<void>();

  projects$: Observable<any[] | null> = of(null);
  private latestProjects: any[] = [];
  error: string | null = null;
  searchText = '';

  displayDialog = false;
  isEditMode = false;
  selectedProjectId: number | null = null;

  newProject: {
    name: string;
    description: string;
    startDate: string;
    deadline: string;
    managerId: number | null;
    requiredSkillIds: number[];
  } = { name: '', description: '', startDate: '', deadline: '', managerId: null, requiredSkillIds: [] };

  displayProposeDialog = false;
  proposeIdea = { name: '', description: '', deadline: '' as string | null };
  proposeSubmitting = false;
  projectManagers: ProjectManagerOption[] = [];
  projectManagersLoadError: string | null = null;
  allSkills: Skill[] = [];
  skillsLoading = false;

  constructor(
    private projectService: ProjectService,
    private userService: UserService,
    private skillService: SkillService,
    private api: ApiService,
    private ws: WebsocketService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {
    this.ws.getProjectUpdates().subscribe(() => {
      this.refresh$.next();
    });
  }

  ngOnInit() {
    this.detectRole();
    if (this.isClient) {
      this.pageTitle = 'My projects';
    } else {
      this.pageTitle = this.isAdmin ? 'All Projects' : 'Project List';
    }

    this.projects$ = this.refresh$.pipe(
      startWith(null),
      switchMap(() => {
        this.error = null;
        return this.loadProjectsByRole().pipe(
          tap((projects) => {
            this.latestProjects = projects ?? [];
          }),
          catchError(() => {
            this.error = 'Unable to load projects.';
            this.latestProjects = [];
            return of([]);
          })
        )
      })
    ) as Observable<any[] | null>;
  }

  private detectRole() {
    this.role = this.api.getResolvedRole();
  }

  get isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  get isProjectManager(): boolean {
    return this.role === 'PROJECT_MANAGER';
  }

  get isCollaborator(): boolean {
    return this.role === 'COLLABORATOR';
  }

  get isClient(): boolean {
    return this.role === 'CLIENT';
  }

  get canManageProjects(): boolean {
    return this.isAdmin || this.isProjectManager;
  }

  get canProposeIdea(): boolean {
    return this.isProjectManager || this.isCollaborator;
  }

  get showNewProjectFormDialog(): boolean {
    return this.displayDialog && this.isAdmin;
  }

  projectManagerOptions(): { label: string; value: number }[] {
    return this.projectManagers.map((u) => ({
      label: `${u.firstName} ${u.lastName} (${u.email})`,
      value: u.id
    }));
  }

  get projectDetailBase(): string {
    if (this.isAdmin) {
      return '/dashboard/admin/projects';
    }
    if (this.isCollaborator) {
      return '/dashboard/collab/projects';
    }
    if (this.isClient) {
      return '/dashboard/client/projects';
    }
    return '/dashboard/pm/projects';
  }

  private loadProjectsByRole(): Observable<any[]> {
    return this.isAdmin ? this.projectService.getAllProjects() : this.projectService.myProjects();
  }

  filteredProjects(projects: any[] | null): any[] {
    const safeProjects = projects ?? [];
    const search = this.searchText.trim().toLowerCase();

    if (!search) {
      return safeProjects;
    }

    return safeProjects.filter((project) => {
      const name = String(project?.name ?? '').toLowerCase();
      // Search by project "name" only (requested: subject by name).
      return name.includes(search);
    });
  }

  /** Active work: not archived, not paused, not marked delivered. */
  isProjectInProgress(project: any): boolean {
    return !project?.archived && !project?.paused && !project?.delivered && !this.isProjectNotStarted(project);
  }

  /** Planned for the future: created but start date is after today. */
  isProjectNotStarted(project: any): boolean {
    if (!project?.startDate) {
      return false;
    }
    const start = new Date(project.startDate);
    if (Number.isNaN(start.getTime())) {
      return false;
    }
    const today = new Date();
    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return start.getTime() > today.getTime();
  }

  filteredInProgressProjects(projects: any[] | null): any[] {
    return this.filteredProjects(projects).filter((p) => this.isProjectInProgress(p));
  }

  filteredPausedProjects(projects: any[] | null): any[] {
    return this.filteredProjects(projects).filter((p) => !!p?.paused && !p?.archived && !p?.delivered);
  }

  /** Alert panel: only projects that are created but not started yet. */
  filteredNotStartedProjects(projects: any[] | null): any[] {
    return this.filteredProjects(projects)
      .filter((p) => this.isProjectNotStarted(p) && !p?.archived && !p?.delivered && !p?.paused)
      // Show the soonest-starting projects first.
      .sort((a, b) => {
        const aTime = new Date(a?.startDate ?? '').getTime();
        const bTime = new Date(b?.startDate ?? '').getTime();
        const safeA = Number.isNaN(aTime) ? Number.POSITIVE_INFINITY : aTime;
        const safeB = Number.isNaN(bTime) ? Number.POSITIVE_INFINITY : bTime;
        if (safeA !== safeB) return safeA - safeB;
        return String(a?.name ?? '').localeCompare(String(b?.name ?? ''));
      });
  }

  deliveredProjects(projects: any[] | null): any[] {
    return this.filteredProjects(projects).filter((p) => !!p?.delivered && !p?.archived);
  }

  completionRate(projects: any[] | null): number {
    const total = this.filteredProjects(projects).length;
    if (!total) {
      return 0;
    }
    return Math.round((this.deliveredProjects(projects).length / total) * 100);
  }

  otherProjectStateLabel(project: any): string {
    if (project?.archived) {
      return 'Archived';
    }
    if (project?.delivered) {
      return 'Delivered';
    }
    if (project?.paused) {
      return 'Paused';
    }
    if (this.isProjectNotStarted(project)) {
      return 'Not started';
    }
    return 'Other';
  }

  showDialog() {
    this.isEditMode = false;
    this.newProject = { name: '', description: '', startDate: '', deadline: '', managerId: null, requiredSkillIds: [] };
    this.projectManagersLoadError = null;
    this.loadSkillsIfNeeded();
    this.userService.getProjectManagersForAdmin().subscribe({
      next: (m) => {
        this.projectManagers = m;
        this.displayDialog = true;
      },
      error: () => {
        this.projectManagersLoadError = 'Could not load project managers.';
        this.notify('error', 'Error', 'Could not load project managers for assignment.');
        this.displayDialog = true;
      }
    });
  }

  closeDialog() {
    this.displayDialog = false;
    this.isEditMode = false;
    this.selectedProjectId = null;
  }

  editProject(project: any) {
    this.isEditMode = true;
    this.selectedProjectId = project.id;
    this.newProject = {
      ...project,
      requiredSkillIds: (project.requiredSkills ?? []).map((s: Skill) => s.id)
    };
    this.loadSkillsIfNeeded();
    this.displayDialog = true;
  }

  private loadSkillsIfNeeded(): void {
    if (this.allSkills.length > 0 || this.skillsLoading) {
      return;
    }
    this.skillsLoading = true;
    this.skillService.getAllSkills().subscribe({
      next: (skills) => {
        this.allSkills = skills;
        this.skillsLoading = false;
      },
      error: () => {
        this.skillsLoading = false;
        this.notify('error', 'Error', 'Could not load skills catalog.');
      }
    });
  }

  private notify(severity: string, summary: string, detail: string) {
    this.messageService.add({ severity, summary, detail });
  }

  private validateProjectName(): boolean {

    const name = this.newProject.name?.trim().toLowerCase();

    if (!name) {
      this.notify('error', 'Validation Error', 'Project name cannot be empty');
      return false;
    }

    const exists = this.latestProjects.some(project =>
      project.id !== this.selectedProjectId &&
      project.name.trim().toLowerCase() === name
    );

    if (exists) {
      this.notify('error', 'Validation Error', 'A project with this name already exists');
      return false;
    }

    return true;
  }

  private saveProject() {
    if (!this.validateProjectName()) return;

    const isEditing = this.isEditMode;

    if (!isEditing && this.isAdmin) {
      if (this.newProject.managerId == null) {
        this.notify('error', 'Validation', 'Select a project manager for this new project.');
        return;
      }
    }

    if (
      this.newProject.startDate &&
      this.newProject.deadline &&
      this.newProject.startDate > this.newProject.deadline
    ) {
      this.notify('error', 'Validation', 'Start date must be on or before the deadline.');
      return;
    }

    const request = isEditing
      ? this.projectService.updateProject(this.selectedProjectId!, {
          name: this.newProject.name,
          description: this.newProject.description,
          startDate: this.newProject.startDate || undefined,
          deadline: this.newProject.deadline || undefined,
          requiredSkills: this.newProject.requiredSkillIds.map((id) => ({ id }))
        })
      : this.projectService.createProject({
          name: this.newProject.name,
          description: this.newProject.description,
          startDate: this.newProject.startDate || undefined,
          deadline: this.newProject.deadline || undefined,
          manager: { id: this.newProject.managerId! },
          requiredSkills: this.newProject.requiredSkillIds.map((id) => ({ id }))
        });

    request.subscribe({
      next: () => {
        this.closeDialog();
        this.refresh$.next();

        this.notify(
          'success',
          'Success',
          isEditing
            ? 'Project updated successfully'
            : 'Project created successfully'
        );
      },
      error: (err) => {
        const msg = err?.error?.message;
        this.notify(
          'error',
          'Request Failed',
          typeof msg === 'string' ? msg
            : isEditing
            ? 'Project was updated on the server, but the app could not finish the request cleanly.'
            : 'Unable to save the project.'
        );
      }
    });
  }

  showProposeDialog() {
    this.proposeIdea = { name: '', description: '', deadline: null };
    this.displayProposeDialog = true;
  }

  closeProposeDialog() {
    this.displayProposeDialog = false;
  }

  submitProposal() {
    const name = this.proposeIdea.name?.trim();
    if (!name) {
      this.notify('error', 'Validation', 'Please enter a name for the idea.');
      return;
    }
    this.proposeSubmitting = true;
    this.projectService
      .submitProjectProposal({
        name,
        description: this.proposeIdea.description,
        deadline: this.proposeIdea.deadline || null
      })
      .subscribe({
        next: () => {
          this.proposeSubmitting = false;
          this.closeProposeDialog();
          this.notify('success', 'Submitted', 'Your project idea was sent to the administrator for review.');
        },
        error: (err) => {
          this.proposeSubmitting = false;
          const m = err?.error?.message;
          this.notify('error', 'Error', typeof m === 'string' ? m : 'Could not submit the proposal.');
        }
      });
  }

  createProject() {
    this.saveProject();
  }

  updateProject() {
    this.isEditMode = true;
    this.saveProject();
  }

  archiveProject(event: { id: number; archived: boolean; nativeEvent: Event }) {

    const action = event.archived ? 'Archive' : 'Unarchive';

    this.confirmationService.confirm({
      target: event.nativeEvent.target as EventTarget,
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

        this.projectService.archiveProject(event.id, event.archived).subscribe({
          next: () => {
            this.refresh$.next();
            this.notify(
              'info',
              `${action}d`,
              event.archived
                ? 'Projet archivé. Il apparaît dans le menu « Archived projects » / Projets archivés.'
                : `Project ${action.toLowerCase()}d successfully.`
            );
          },
          error: (err) => {
            const m = err?.error?.message ?? err?.error?.error;
            this.notify(
              'error',
              'Échec',
              typeof m === 'string' ? m : 'Impossible de modifier le statut d’archivage. Vérifiez d’être connecté en administrateur.'
            );
          }
        });
      }
    });
  }

  pauseProject(event: { id: number; paused: boolean; nativeEvent: Event }): void {
    const action = event.paused ? 'pause' : 'resume';
    this.confirmationService.confirm({
      target: event.nativeEvent.target as EventTarget,
      message: event.paused
        ? 'Pause this project? The team can still view it; task changes should follow your internal process.'
        : 'Resume this project and clear the paused state?',
      header: event.paused ? 'Pause project' : 'Resume project',
      icon: 'pi pi-info-circle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: event.paused ? 'Pause' : 'Resume', severity: 'warning' },
      accept: () => {
        this.projectService.setProjectLifecycle(event.id, { paused: event.paused }).subscribe({
          next: () => {
            this.refresh$.next();
            this.notify('success', 'Updated', `Project ${action}d successfully.`);
          },
          error: (err) => {
            const m = err?.error?.message ?? err?.error?.error;
            this.notify('error', 'Error', typeof m === 'string' ? m : 'Could not update the project.');
          }
        });
      }
    });
  }

  deliverProject(event: { id: number; delivered: boolean; nativeEvent: Event }): void {
    this.confirmationService.confirm({
      target: event.nativeEvent.target as EventTarget,
      message: event.delivered
        ? 'Mark this project as delivered (closed) for delivery tracking?'
        : 'Reopen this project and clear the delivered state?',
      header: event.delivered ? 'Mark as delivered' : 'Reopen project',
      icon: 'pi pi-info-circle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: event.delivered ? 'Mark delivered' : 'Reopen', severity: 'success' },
      accept: () => {
        this.projectService.setProjectLifecycle(event.id, { delivered: event.delivered }).subscribe({
          next: () => {
            this.refresh$.next();
            this.notify('success', 'Updated', 'Project status was updated.');
          },
          error: (err) => {
            const m = err?.error?.message ?? err?.error?.error;
            this.notify('error', 'Error', typeof m === 'string' ? m : 'Could not update the project.');
          }
        });
      }
    });
  }

}
