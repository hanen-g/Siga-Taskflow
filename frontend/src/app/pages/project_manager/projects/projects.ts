import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, switchMap, startWith, tap } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
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
import { AdminUser, UserService, ProjectManagerOption } from '../../../services/user.service';
import { WebsocketService } from '../../../services/websocket.service';
import { ApiService } from '../../../services/api';
import { ProjectPanel } from './project-panel';
import { AppLoaderComponent } from '../../../layout/app-loader';
import { Skill } from '../../../models/skill.model';
import { SkillService } from '../../../services/skill.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  standalone: true,
  selector: 'app-projects-page',
  templateUrl: './projects.html',
  styleUrls: ['./projects.css'],
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
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

  /** URL: ?filter=… | (none) full dashboard */
  projectsViewFilter: 'all' | 'not-started' | 'in-progress' | 'paused' = 'all';
  readonly navFilterNotStarted = { filter: 'not-started' };
  readonly navFilterInProgress = { filter: 'in-progress' };
  readonly navFilterPaused = { filter: 'paused' };

  role: string | null = null;
  pageTitle = 'Projects';

  private readonly destroyRef = inject(DestroyRef);
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
    /** Admin create only: existing CLIENT users invited to the project. */
    clientIds: number[];
  } = {
    name: '',
    description: '',
    startDate: '',
    deadline: '',
    managerId: null,
    requiredSkillIds: [],
    clientIds: []
  };

  /** Active clients for optional assignment on new project (admin). */
  activeClientsForProject: AdminUser[] = [];
  clientSelectOptions: { label: string; value: number }[] = [];

  displayProposeDialog = false;
  proposeIdea = { name: '', description: '', deadline: '' as string | null };
  proposeSubmitting = false;
  projectManagers: ProjectManagerOption[] = [];
  projectManagersLoadError: string | null = null;
  allSkills: Skill[] = [];
  skillsLoading = false;

  /** Pending project ideas (admin): shown as urgent alert above in-progress projects. */
  pendingProposals: any[] = [];

  constructor(
    private projectService: ProjectService,
    private userService: UserService,
    private skillService: SkillService,
    private api: ApiService,
    private ws: WebsocketService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private route: ActivatedRoute,
    private notificationService: NotificationService,
  ) {
    this.ws.getProjectUpdates().subscribe(() => {
      this.refresh$.next();
    });
  }

  ngOnInit() {
    this.detectRole();
    this.syncProjectsViewFilterFromRoute();
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncProjectsViewFilterFromRoute());

    this.projects$ = this.refresh$.pipe(
      startWith(null),
      switchMap(() => {
        this.error = null;
        return this.loadProjectsByRole().pipe(
          tap((projects) => {
            this.latestProjects = projects ?? [];
            if (this.isAdmin) {
              this.loadPendingProposals();
            } else {
              this.pendingProposals = [];
            }
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

  private syncProjectsViewFilterFromRoute(): void {
    const f = this.route.snapshot.queryParamMap.get('filter');
    if (f === 'not-started') {
      this.projectsViewFilter = 'not-started';
    } else if (f === 'in-progress') {
      this.projectsViewFilter = 'in-progress';
    } else if (f === 'paused') {
      this.projectsViewFilter = 'paused';
    } else {
      this.projectsViewFilter = 'all';
    }
    this.applyProjectsPageTitle();
    if (this.projectsViewFilter === 'not-started') {
      setTimeout(() => this.scrollNotStartedSectionIntoView(), 150);
    } else if (this.projectsViewFilter === 'in-progress') {
      setTimeout(() => this.scrollInProgressSectionIntoView(), 150);
    } else if (this.projectsViewFilter === 'paused') {
      setTimeout(() => this.scrollPausedSectionIntoView(), 150);
    }
  }

  private applyProjectsPageTitle(): void {
    if (this.isClient) {
      this.pageTitle = 'My projects';
      return;
    }
    if (this.projectsViewFilter === 'not-started') {
      this.pageTitle = this.isAdmin ? 'All Projects — Not started' : 'Project List — Not started';
      return;
    }
    if (this.projectsViewFilter === 'in-progress') {
      this.pageTitle = this.isAdmin ? 'All Projects — In progress' : 'Project List — In progress';
      return;
    }
    if (this.projectsViewFilter === 'paused') {
      this.pageTitle = this.isAdmin ? 'All Projects — Paused' : 'Project List — Paused';
      return;
    }
    this.pageTitle = this.isAdmin ? 'All Projects' : 'Project List';
  }

  get projectsListRoute(): string[] {
    if (this.isAdmin) {
      return ['/dashboard/admin/projects'];
    }
    if (this.isCollaborator) {
      return ['/dashboard/collab/projects'];
    }
    if (this.isClient) {
      return ['/dashboard/client'];
    }
    return ['/dashboard/pm/projects'];
  }

  supportsNotStartedNav(): boolean {
    return this.isAdmin || this.isProjectManager || this.isCollaborator;
  }

  /** Roles that may use filtered project list URLs (?filter=…). */
  supportsStatusFilteredNav(): boolean {
    return this.supportsNotStartedNav();
  }

  /** Full grid: en cours + pause + sidebar + banners. Single-column filtered views omit this. */
  showsFullProjectsDashboard(): boolean {
    return this.projectsViewFilter === 'all';
  }

  /**
   * PM / collaborator project list: only “in progress” projects (no paused column, sidebar, or idea panel).
   */
  showsOngoingProjectsOnlyLayout(): boolean {
    return this.canProposeIdea && !this.isAdmin && !this.isClient;
  }

  isFilteredSingleColumnLayout(): boolean {
    return (
      this.projectsViewFilter === 'not-started' ||
      this.projectsViewFilter === 'in-progress' ||
      this.projectsViewFilter === 'paused'
    );
  }

  private scrollNotStartedSectionIntoView(): void {
    document.getElementById('projects-not-started-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private scrollInProgressSectionIntoView(): void {
    document.getElementById('projects-in-progress-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private scrollPausedSectionIntoView(): void {
    document.getElementById('projects-paused-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  /** Create is admin-only; edit can be opened by a project manager (name, dates, skills) or admin (full staffing). */
  get showNewProjectFormDialog(): boolean {
    return this.displayDialog && (this.isAdmin || this.isEditMode);
  }

  /** Normalized ids for multiselect + API (avoids string/number mismatches). Exposed for template hints. */
  normalizedRequiredSkillIds(): number[] {
    const raw = this.newProject.requiredSkillIds ?? [];
    const nums = raw.map((id) => Number(id)).filter((n) => Number.isFinite(n));
    return [...new Set(nums)];
  }

  private pmSkillIdSet(pm: ProjectManagerOption): Set<number> {
    return new Set(
      (pm.skillIds ?? [])
        .map((id) => Number(id))
        .filter((n) => Number.isFinite(n))
    );
  }

  /** Count of required skills (from `required`) that this PM has. */
  private pmSkillOverlapCount(pm: ProjectManagerOption, required: number[]): number {
    if (!required.length) {
      return 0;
    }
    const pmSkills = this.pmSkillIdSet(pm);
    return required.filter((id) => pmSkills.has(id)).length;
  }

  /**
   * Project managers to suggest from selected skills:
   * no skills → all PMs; otherwise those sharing **at least one** skill (sort: **full** matches first, then by overlap count).
   */
  projectManagersMatchingRequiredSkills(): ProjectManagerOption[] {
    const required = this.normalizedRequiredSkillIds();
    if (!required.length) {
      return this.projectManagers;
    }
    const need = new Set(required);
    const scored = this.projectManagers.map((pm) => {
      const matchCount = this.pmSkillOverlapCount(pm, required);
      const full = matchCount === need.size;
      return { pm, matchCount, full };
    });
    const matched = scored.filter((s) => s.matchCount > 0);
    matched.sort((a, b) => {
      if (a.full !== b.full) {
        return a.full ? -1 : 1;
      }
      if (b.matchCount !== a.matchCount) {
        return b.matchCount - a.matchCount;
      }
      const la = `${a.pm.firstName ?? ''} ${a.pm.lastName ?? ''}`.trim();
      const lb = `${b.pm.firstName ?? ''} ${b.pm.lastName ?? ''}`.trim();
      return la.localeCompare(lb, undefined, { sensitivity: 'base' });
    });
    return matched.map((s) => s.pm);
  }

  /** At least one PM has every selected skill. */
  projectManagersIncludeFullSkillCover(): boolean {
    const required = this.normalizedRequiredSkillIds();
    if (!required.length) {
      return true;
    }
    const need = new Set(required);
    return this.projectManagers.some((pm) => {
      const pmSkills = this.pmSkillIdSet(pm);
      for (const id of need) {
        if (!pmSkills.has(id)) {
          return false;
        }
      }
      return true;
    });
  }

  projectManagerOptions(): { label: string; value: number }[] {
    const required = this.normalizedRequiredSkillIds();
    return this.projectManagersMatchingRequiredSkills().map((u) => {
      const n = required.length;
      let suffix = '';
      if (n > 0) {
        const mc = this.pmSkillOverlapCount(u, required);
        if (mc < n) {
          suffix = ` — ${mc}/${n} skill(s)`;
        }
      }
      return {
        label: `${u.firstName} ${u.lastName} (${u.email})${suffix}`,
        value: u.id
      };
    });
  }

  onRequiredSkillsForProjectChange(): void {
    const match = this.projectManagersMatchingRequiredSkills();
    const allowed = new Set(match.map((m) => m.id));
    if (this.newProject.managerId != null && !allowed.has(this.newProject.managerId)) {
      this.newProject.managerId = null;
    }
    if (match.length === 1) {
      this.newProject.managerId = match[0].id;
    }
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

  private loadPendingProposals(): void {
    this.projectService.listPendingProposals().subscribe({
      next: (list) => {
        this.pendingProposals = Array.isArray(list) ? list : [];
      },
      error: () => {
        this.pendingProposals = [];
      }
    });
  }

  get projectProposalsReviewPath(): string {
    return '/dashboard/admin/project-proposals';
  }

  proposalProposerLine(p: {
    proposerFirstName?: string;
    proposerLastName?: string;
    proposerEmail?: string;
  }): string {
    const n = [p.proposerFirstName, p.proposerLastName].filter(Boolean).join(' ').trim();
    return n || p.proposerEmail || '—';
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

  /** Planned for the future: start date (calendar day) is strictly after today. Uses YYYY-MM-DD to avoid UTC midnight shifts. */
  isProjectNotStarted(project: any): boolean {
    const startYmd = this.projectStartDateYmd(project?.startDate);
    if (!startYmd) {
      return false;
    }
    return startYmd > this.todayYmdLocal();
  }

  private todayYmdLocal(): string {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }

  /** Normalizes API values (ISO date, datetime prefix, or Jackson [y,m,d]) to YYYY-MM-DD. */
  private projectStartDateYmd(raw: unknown): string | null {
    if (raw == null || raw === '') {
      return null;
    }
    if (typeof raw === 'string') {
      const head = raw.length >= 10 ? raw.slice(0, 10) : raw;
      if (/^\d{4}-\d{2}-\d{2}$/.test(head)) {
        return head;
      }
    }
    if (Array.isArray(raw) && raw.length >= 3) {
      const y = Number(raw[0]);
      const m = Number(raw[1]);
      const d = Number(raw[2]);
      if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    return null;
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
        const ay = this.projectStartDateYmd(a?.startDate) ?? '9999-12-31';
        const by = this.projectStartDateYmd(b?.startDate) ?? '9999-12-31';
        if (ay !== by) return ay.localeCompare(by);
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
    this.newProject = {
      name: '',
      description: '',
      startDate: '',
      deadline: '',
      managerId: null,
      requiredSkillIds: [],
      clientIds: []
    };
    this.projectManagersLoadError = null;
    this.activeClientsForProject = [];
    this.clientSelectOptions = [];
    this.loadSkillsIfNeeded();
    forkJoin({
      pms: this.userService.getProjectManagersForAdmin(),
      clients: this.userService.getAdminUsers('', 'CLIENT', 'active')
    }).subscribe({
      next: ({ pms, clients }) => {
        this.projectManagers = pms;
        this.activeClientsForProject = clients ?? [];
        this.rebuildClientSelectOptions();
        this.displayDialog = true;
      },
      error: () => {
        this.projectManagersLoadError = 'Could not load project managers or clients.';
        this.notify('error', 'Error', 'Could not load data for the create form.');
        this.activeClientsForProject = [];
        this.clientSelectOptions = [];
        this.userService.getProjectManagersForAdmin().subscribe({
          next: (m) => {
            this.projectManagers = m;
            this.displayDialog = true;
          },
          error: () => {
            this.projectManagers = [];
            this.displayDialog = true;
          }
        });
      }
    });
  }

  private rebuildClientSelectOptions(): void {
    this.clientSelectOptions = this.activeClientsForProject.map((c) => {
      const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
      return {
        label: name ? `${name} (${c.email})` : c.email,
        value: c.id
      };
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
    this.loadSkillsIfNeeded();
    this.projectManagersLoadError = null;
    const detail$ = this.projectService.getProject(project.id);
    if (this.isAdmin) {
      forkJoin({
        pms: this.userService.getProjectManagersForAdmin(),
        clients: this.userService.getAdminUsers('', 'CLIENT', 'active'),
        detail: detail$
      }).subscribe({
        next: ({ pms, clients, detail }) => {
          this.projectManagers = pms;
          this.activeClientsForProject = clients ?? [];
          this.rebuildClientSelectOptions();
          this.patchNewProjectFromDetail(detail);
          this.displayDialog = true;
        },
        error: () => {
          this.notify('error', 'Error', 'Could not load project for editing.');
          this.isEditMode = false;
          this.selectedProjectId = null;
        }
      });
    } else {
      detail$.subscribe({
        next: (detail) => {
          this.patchNewProjectFromDetail(detail);
          this.displayDialog = true;
        },
        error: () => {
          this.notify('error', 'Error', 'Could not load project for editing.');
          this.isEditMode = false;
          this.selectedProjectId = null;
        }
      });
    }
  }

  private patchNewProjectFromDetail(detail: any): void {
    this.newProject = {
      name: detail?.name ?? '',
      description: detail?.description ?? '',
      startDate: detail?.startDate ?? '',
      deadline: detail?.deadline ?? '',
      managerId: detail?.managerId ?? null,
      requiredSkillIds: (detail?.requiredSkills ?? []).map((s: Skill) => s.id),
      clientIds: [...(detail?.clientIds ?? [])]
    };
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

    if (this.isAdmin) {
      if (this.normalizedRequiredSkillIds().length && this.projectManagersMatchingRequiredSkills().length === 0) {
        this.notify(
          'error',
          'Validation',
          'No project manager has at least one of the selected skills. Assign skills on profiles or adjust your selection.'
        );
        return;
      }
      if (this.newProject.managerId == null) {
        this.notify(
          'error',
          'Validation',
          isEditing ? 'Select a project manager for this project.' : 'Select a project manager for this new project.'
        );
        return;
      }
      const allowed = new Set(this.projectManagersMatchingRequiredSkills().map((m) => m.id));
      if (!allowed.has(this.newProject.managerId)) {
        this.notify('error', 'Validation', 'The chosen project manager does not match the filtered skills.');
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

    const clientIdsNorm = (this.newProject.clientIds ?? [])
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n) && n > 0);

    const request = isEditing
      ? this.projectService.updateProject(this.selectedProjectId!, {
          name: this.newProject.name,
          description: this.newProject.description,
          startDate: this.newProject.startDate || undefined,
          deadline: this.newProject.deadline || undefined,
          requiredSkills: this.newProject.requiredSkillIds.map((id) => ({ id: Number(id) })),
          ...(this.isAdmin &&
          this.newProject.managerId != null &&
          Number.isFinite(Number(this.newProject.managerId))
            ? {
                manager: { id: Number(this.newProject.managerId) },
                clientIds: clientIdsNorm
              }
            : {})
        })
      : this.projectService.createProject({
          name: this.newProject.name,
          description: this.newProject.description,
          startDate: this.newProject.startDate || undefined,
          deadline: this.newProject.deadline || undefined,
          manager: { id: this.newProject.managerId! },
          requiredSkills: this.newProject.requiredSkillIds.map((id) => ({ id })),
          clientIds: clientIdsNorm
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
          typeof msg === 'string' ? msg : isEditing ? 'Could not update the project.' : 'Unable to save the project.'
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
          this.refresh$.next();
          this.notificationService.requestNotificationsRefresh();
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
                ? 'Project archived. You can find it under Archived projects in the menu.'
                : `Project ${action.toLowerCase()}d successfully.`
            );
          },
          error: (err) => {
            const m = err?.error?.message ?? err?.error?.error;
            this.notify(
              'error',
              'Failed',
              typeof m === 'string' ? m : 'Could not change archive status. Make sure you are signed in as an administrator.'
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

  /**
   * Moves a “not started” project (future start date) into “in progress” by setting start date to today.
   */
  startProjectNow(project: any): void {
    if (!project?.id) {
      return;
    }
    const deadlineYmd = this.projectStartDateYmd(project.deadline);
    const skillIds = (project.requiredSkills ?? [])
      .map((s: Skill) => Number((s as Skill)?.id))
      .filter((n: number) => Number.isFinite(n));

    this.projectService
      .updateProject(project.id, {
        name: project.name,
        description: project.description ?? '',
        startDate: this.todayYmdLocal(),
        ...(deadlineYmd ? { deadline: deadlineYmd } : {}),
        requiredSkills: skillIds.map((id: number) => ({ id }))
      })
      .subscribe({
        next: () => {
          this.refresh$.next();
          this.notify(
            'success',
            'Project started',
            'The start date is set to today; the project now appears under projects in progress.'
          );
        },
        error: (err) => {
          const msg = err?.error?.message;
          this.notify(
            'error',
            'Error',
            typeof msg === 'string' ? msg : 'Could not start the project.'
          );
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
