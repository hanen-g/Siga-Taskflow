import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject, of } from 'rxjs';
import { catchError, finalize, switchMap, startWith, tap } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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

import { AssigneeCandidate, ProjectService } from '../../services/project.service';
import { UserService, ProjectManagerOption, ClientAccountOption } from '../../services/user.service';
import { WebsocketService } from '../../services/websocket.service';
import { ApiService } from '../../services/api';
import { ProjectPanel } from './project-panel';
import { AppLoaderComponent } from '../../layout/app-loader';
import { Skill } from '../../models/skill.model';
import { Project } from '../../models/project.model';
import { SkillService } from '../../services/skill.service';

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
  readonly projectStatusLegend = [
    { code: 0, label: 'Proposed', color: 'orange' },
    { code: 1, label: 'Not started', color: 'yellow' },
    { code: 2, label: 'In progress', color: 'blue' },
    { code: 3, label: 'Archived', color: 'gray' },
    { code: 4, label: 'Delivered', color: 'teal' },
    { code: 5, label: 'Paused', color: 'slate' }
  ];

  /** URL: ?filter=… | (none) full dashboard */
  projectsViewFilter: 'all' | 'not-started' | 'in-progress' | 'paused' = 'all';
  readonly navFilterNotStarted = { filter: 'not-started' };
  readonly navFilterInProgress = { filter: 'in-progress' };
  readonly navFilterPaused = { filter: 'paused' };

  role: string | null = null;
  pageTitle = 'Projects';

  private readonly destroyRef = inject(DestroyRef);
  private refresh$ = new Subject<void>();

  projects$: Observable<Project[] | null> = of(null);
  private latestProjects: Project[] = [];
  error: string | null = null;
  searchText = '';

  displayDialog = false;

  newProject: {
    name: string;
    description: string;
    startDate: string;
    deadline: string;
    managerId: number | null;
    requiredSkillIds: number[];
    clientIds: number[];
  } = { name: '', description: '', startDate: '', deadline: '', managerId: null, requiredSkillIds: [], clientIds: [] };

  displayProposeDialog = false;
  proposeIdea = { name: '', description: '', clientContact: '' as string | null };
  proposeSubmitting = false;
  projectManagers: ProjectManagerOption[] = [];
  projectManagersLoadError: string | null = null;
  allSkills: Skill[] = [];
  skillsLoading = false;
  clients: ClientAccountOption[] = [];
  clientsLoading = false;
  clientsLoadError: string | null = null;

  /** Optional file uploaded with admin “create project”. */
  createProjectAttachmentFile: File | null = null;
  saveInProgress = false;

  /**
   * When the admin opens “create project” from a proposal, the row is deleted on the server
   * after a successful POST /api/projects with {@code consumedProposalId}.
   */
  createFromProposalId: number | null = null;
  /** Display-only hint from the proposer (client contact text; maps to Clients multiselect manually). */
  proposalClientContactHint: string | null = null;

  /** Pending project ideas (admin): shown as urgent alert above in-progress projects. */
  pendingProposals: any[] = [];

  /** Create-project dialog: project managers filtered by workload (same backend as assignee hints). */
  pmCandidatesPopupVisible = false;
  pmCandidates: AssigneeCandidate[] = [];
  pmCandidatesLoading = false;
  private pmCandidateLoadSeq = 0;

  constructor(
    private projectService: ProjectService,
    private userService: UserService,
    private skillService: SkillService,
    private api: ApiService,
    private ws: WebsocketService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private route: ActivatedRoute,
    private router: Router
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
      .subscribe((params) => {
        this.syncProjectsViewFilterFromRoute();
        this.tryOpenCreateDialogFromApproveProposal(params);
      });

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
    ) as Observable<Project[] | null>;
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
    return this.isAdmin || this.isProjectManager || this.isCollaborator || this.isClient;
  }

  /** Full grid: en cours + pause + sidebar + banners. Single-column filtered views omit this. */
  showsFullProjectsDashboard(): boolean {
    return this.projectsViewFilter === 'all';
  }

  /**
   * Liste projet PM / collaborateur : uniquement les projets « en cours » (pas pause, pas colonne latérale, pas idées).
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

  get showNewProjectFormDialog(): boolean {
    return this.displayDialog && this.isAdmin;
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

  /**
   * Same rule as assignee suggestions: if required skills are selected, only managers who have **all**
   * of them; otherwise show every project manager.
   */
  projectManagersMatchingRequiredSkills(): ProjectManagerOption[] {
    const required = this.normalizedRequiredSkillIds();
    if (!required.length) {
      return [...this.projectManagers].sort((a, b) =>
        `${a.firstName ?? ''} ${a.lastName ?? ''}`
          .trim()
          .localeCompare(`${b.firstName ?? ''} ${b.lastName ?? ''}`.trim(), undefined, { sensitivity: 'base' })
      );
    }
    const need = new Set(required);
    const matched = this.projectManagers.filter((pm) => {
      const pmSkills = this.pmSkillIdSet(pm);
      for (const id of need) {
        if (!pmSkills.has(id)) {
          return false;
        }
      }
      return true;
    });
    matched.sort((a, b) =>
      `${a.firstName ?? ''} ${a.lastName ?? ''}`
        .trim()
        .localeCompare(`${b.firstName ?? ''} ${b.lastName ?? ''}`.trim(), undefined, { sensitivity: 'base' })
    );
    return matched;
  }

  projectManagerOptions(): { label: string; value: number }[] {
    return this.projectManagersMatchingRequiredSkills().map((u) => ({
      label: `${u.firstName} ${u.lastName} (${u.email})`,
      value: u.id
    }));
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
    if (this.pmCandidatesPopupVisible && this.isAdmin) {
      this.loadProjectManagerCandidatesForCreateForm();
    }
  }

  openProjectManagerCandidatesPopup(): void {
    if (!this.isAdmin || !this.displayDialog) {
      return;
    }
    this.pmCandidatesPopupVisible = true;
    this.loadProjectManagerCandidatesForCreateForm();
  }

  onProjectManagerCandidatesDialogHide(): void {
    this.resetPmCandidatesState();
  }

  private resetPmCandidatesState(): void {
    this.pmCandidatesPopupVisible = false;
    this.pmCandidates = [];
    this.pmCandidatesLoading = false;
    this.pmCandidateLoadSeq++;
  }

  loadProjectManagerCandidatesForCreateForm(): void {
    const seq = ++this.pmCandidateLoadSeq;
    this.pmCandidatesLoading = true;
    const ids = this.normalizedRequiredSkillIds();
    this.projectService.getProjectManagerCandidates(ids).subscribe({
      next: (rows) => {
        if (seq !== this.pmCandidateLoadSeq) {
          return;
        }
        this.pmCandidates = (rows ?? []).filter((r) => (r.role ?? '') === 'PROJECT_MANAGER');
        this.pmCandidatesLoading = false;
      },
      error: () => {
        if (seq !== this.pmCandidateLoadSeq) {
          return;
        }
        this.pmCandidates = [];
        this.pmCandidatesLoading = false;
        this.notify('error', 'Error', 'Could not load project manager suggestions.');
      }
    });
  }

  formatProjectManagerCandidateRow(c: AssigneeCandidate): string {
    const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
    const label = name ? `${name} <${c.email}>` : c.email;
    const n = c.activeTaskCount ?? 0;
    const workload = n === 1 ? '1 active task' : `${n} active tasks`;
    const req = this.normalizedRequiredSkillIds();
    const skillNote =
      req.length > 0
        ? ` • skills matched: ${c.matchedSkillCount ?? 0}/${req.length}`
        : '';
    return `${label} — ${workload}${skillNote}`;
  }

  pickProjectManagerFromCandidate(candidate: AssigneeCandidate): void {
    const email = (candidate.email ?? '').trim().toLowerCase();
    const pm = this.projectManagers.find((p) => (p.email ?? '').trim().toLowerCase() === email);
    if (!pm) {
      this.notify('warn', 'Could not assign', 'That manager could not be matched to the roster. Reload the dialog or pick from the dropdown.');
      return;
    }
    const allowed = new Set(this.projectManagersMatchingRequiredSkills().map((m) => m.id));
    if (!allowed.has(pm.id)) {
      this.notify('warn', 'Skills', 'Selected skills require a manager who has all required skills.');
      return;
    }
    this.newProject.managerId = pm.id;
    this.pmCandidatesPopupVisible = false;
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

  private loadProjectsByRole(): Observable<Project[]> {
    return this.isAdmin ? this.projectService.getAllProjects() : this.projectService.myProjects();
  }

  private loadPendingProposals(): void {
    this.projectService.listProposals().subscribe({
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

  private tryOpenCreateDialogFromApproveProposal(params: ParamMap): void {
    if (!this.isAdmin) return;
    const raw = params.get('approveProposal');
    if (!raw) return;
    const id = Number(raw);
    if (!Number.isFinite(id)) return;

    this.projectService
      .getProposal(id)
      .pipe(
        finalize(() => {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { approveProposal: null },
            queryParamsHandling: 'merge',
            replaceUrl: true
          });
        })
      )
      .subscribe({
        next: (p) => this.openCreateDialogPrefilledFromProposal(p),
        error: () => {
          this.notify('warn', 'Proposal', 'That proposal is no longer available.');
        }
      });
  }

  private openCreateDialogPrefilledFromProposal(p: any): void {
    this.displayDialog = false;
    this.resetPmCandidatesState();
    this.createProjectAttachmentFile = null;
    const n = Number(p?.id);
    this.createFromProposalId = Number.isFinite(n) && n >= 1 ? n : null;
    const cc = typeof p?.clientContact === 'string' ? p.clientContact.trim() : '';
    this.proposalClientContactHint = cc.length ? cc : null;
    this.newProject = {
      name: (p?.name as string) ?? '',
      description: (p?.description as string) ?? '',
      startDate: this.nextDayYmdLocal(),
      deadline: '',
      managerId: p?.proposerRole === 'PROJECT_MANAGER' && typeof p?.proposerId === 'number' ? p.proposerId : null,
      requiredSkillIds: [],
      clientIds: []
    };
    this.projectManagersLoadError = null;
    this.loadSkillsIfNeeded();
    this.loadClientsIfNeeded();
    this.userService.getProjectManager().subscribe({
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

  /** Default “not started” start date used when turning a proposal into a project (local calendar day after today). */
  private nextDayYmdLocal(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
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

  /** Admin “All Projects” dashboard: sections shown top-to-bottom when they have items. */
  readonly adminAllProjectsStatusSections: ReadonlyArray<{
    id: 'not-started' | 'in-progress' | 'paused' | 'delivered';
    title: string;
    anchor: string;
  }> = [
    { id: 'not-started', title: 'Not started projects', anchor: 'projects-not-started-anchor' },
    { id: 'in-progress', title: 'Projects in progress', anchor: 'projects-in-progress-anchor' },
    { id: 'paused', title: 'Projects paused', anchor: 'projects-paused-anchor' },
    { id: 'delivered', title: 'Delivered projects', anchor: 'projects-delivered-anchor' }
  ];

  adminVisibleStatusSections(
    projects: any[] | null
  ): { id: string; title: string; anchor: string; projects: any[] }[] {
    return this.adminAllProjectsStatusSections
      .map((section) => ({
        ...section,
        projects: this.projectsForAdminStatusSection(section.id, projects)
      }))
      .filter((section) => section.projects.length > 0);
  }

  adminStatusSectionTitle(section: { id: string; title: string }): string {
    if (section.id === 'in-progress' && this.isClient) {
      return 'Projets actifs';
    }
    return section.title;
  }

  private projectsForAdminStatusSection(
    sectionId: 'not-started' | 'in-progress' | 'paused' | 'delivered',
    projects: any[] | null
  ): any[] {
    switch (sectionId) {
      case 'not-started':
        return this.filteredNotStartedProjects(projects);
      case 'in-progress':
        return this.filteredInProgressProjects(projects);
      case 'paused':
        return this.filteredPausedProjects(projects);
      case 'delivered':
        return this.deliveredProjects(projects);
      default:
        return [];
    }
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

  onCreateProjectFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.createProjectAttachmentFile = input.files?.[0] ?? null;
  }

  showDialog() {
    this.createProjectAttachmentFile = null;
    this.resetPmCandidatesState();
    this.newProject = { name: '', description: '', startDate: '', deadline: '', managerId: null, requiredSkillIds: [], clientIds: [] };
    this.projectManagersLoadError = null;
    this.loadSkillsIfNeeded();
    this.loadClientsIfNeeded();
    this.userService.getProjectManager().subscribe({
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
    this.createProjectAttachmentFile = null;
    this.createFromProposalId = null;
    this.proposalClientContactHint = null;
    this.resetPmCandidatesState();
  }

  private loadClientsIfNeeded(): void {
    if (this.clients.length > 0 || this.clientsLoading) {
      return;
    }
    this.clientsLoading = true;
    this.clientsLoadError = null;
    this.userService.getClients().subscribe({
      next: (list) => {
        this.clients = list ?? [];
        this.clientsLoading = false;
      },
      error: () => {
        this.clients = [];
        this.clientsLoading = false;
        this.clientsLoadError = 'Could not load clients for assignment.';
      }
    });
  }

  clientOptions(): { label: string; value: number }[] {
    return [...this.clients]
      .map((c) => {
        const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
        const company = c.company?.trim();
        const head = company ? company : (name || c.email);
        const detail = company && name ? ` — ${name}` : '';
        const tail = c.email ? ` (${c.email})` : '';
        return { label: `${head}${detail}${tail}`, value: c.id };
      })
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
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

    const name = this.newProject.name.trim().toLowerCase();

    if (!name) {
      this.notify('error', 'Validation Error', 'Project name cannot be empty');
      return false;
    }

    const exists = this.latestProjects.some(
      (project) => project.name.trim().toLowerCase() === name
    );

    if (exists) {
      this.notify('error', 'Validation Error', 'A project with this name already exists');
      return false;
    }

    return true;
  }

  private saveProject() {
    if (this.saveInProgress) {
      return;
    }
    if (!this.validateProjectName()) return;

    if (this.isAdmin) {
      const reqs = this.newProject.requiredSkillIds ?? [];
      if (this.normalizedRequiredSkillIds().length && this.projectManagersMatchingRequiredSkills().length === 0) {
        this.notify(
          'error',
          'Validation',
          'No project manager has all selected required skills. Update skills or user profiles.'
        );
        return;
      }
      if (this.newProject.managerId == null) {
        this.notify('error', 'Validation', 'Select a project manager for this new project.');
        return;
      }
      const allowed = new Set(this.projectManagersMatchingRequiredSkills().map((m) => m.id));
      if (!allowed.has(this.newProject.managerId)) {
        this.notify(
          'error',
          'Validation',
          'The selected project manager does not satisfy the required-skills rule (must have all selected skills).'
        );
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

    this.saveInProgress = true;
    this.projectService
      .createProject({
        name: this.newProject.name,
        description: this.newProject.description,
        startDate: this.newProject.startDate || undefined,
        deadline: this.newProject.deadline || undefined,
        manager: { id: this.newProject.managerId! },
        requiredSkills: this.newProject.requiredSkillIds.map((id) => ({ id })),
        consumedProposalId:
          this.createFromProposalId != null && this.createFromProposalId >= 1
            ? this.createFromProposalId
            : undefined
      })
      .subscribe({
      next: (result: unknown) => {
        const attachment = this.createProjectAttachmentFile;
        const newProjectId =
          result && typeof result === 'object' && 'id' in result ? (result as { id: number }).id : null;

        const continueAfterAttachment = (attachmentFailed: boolean) => {
          this.persistProjectClientsIfNeeded(newProjectId, (clientsFailed) => {
            this.finishProjectSave(attachmentFailed, clientsFailed);
          });
        };

        if (attachment && newProjectId != null) {
          this.projectService.uploadAttachment(newProjectId, attachment).subscribe({
            next: () => {
              this.createProjectAttachmentFile = null;
              continueAfterAttachment(false);
            },
            error: () => {
              this.createProjectAttachmentFile = null;
              continueAfterAttachment(true);
            }
          });
          return;
        }

        continueAfterAttachment(false);
      },
      error: (err) => {
        this.saveInProgress = false;
        const msg = err?.error?.message;
        this.notify(
          'error',
          'Request Failed',
          typeof msg === 'string' ? msg : 'Unable to save the project.'
        );
      }
    });
  }

  /** Sync client assignments after project creation (skipped when none selected). */
  private persistProjectClientsIfNeeded(
    projectId: number | null,
    done: (clientsFailed: boolean) => void
  ): void {
    if (projectId == null) {
      done(false);
      return;
    }
    const desired = [...(this.newProject.clientIds ?? [])];
    if (desired.length === 0) {
      done(false);
      return;
    }
    this.projectService.setProjectClients(projectId, desired).subscribe({
      next: () => done(false),
      error: () => done(true)
    });
  }

  /** @param attachmentUploadFailed only when project was created and optional file upload failed */
  private finishProjectSave(attachmentUploadFailed: boolean, clientsUpdateFailed = false): void {
    this.saveInProgress = false;
    this.closeDialog();
    this.refresh$.next();
    if (attachmentUploadFailed) {
      this.notify(
        'warn',
        'Partial success',
        'The project was created, but the attachment could not be uploaded. You can add a file from the project page.'
      );
    } else if (clientsUpdateFailed) {
      this.notify(
        'warn',
        'Partial success',
        'Project was created, but client assignments could not be saved. Open the project to assign clients.'
      );
    } else {
      this.notify('success', 'Success', 'Project created successfully');
    }
  }

  showProposeDialog() {
    this.proposeIdea = { name: '', description: '', clientContact: '' };
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
    const clientContact = this.proposeIdea.clientContact?.trim() || undefined;
    this.projectService
      .submitProjectProposal({
        name,
        description: this.proposeIdea.description,
        clientContact: clientContact ?? null
      })
      .subscribe({
        next: () => {
          this.proposeSubmitting = false;
          this.closeProposeDialog();
          this.notify('success', 'Submitted', 'Your project idea was sent to the administrator for review.');
          this.refresh$.next();
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

  private projectConfirmPhrase(name: string | undefined | null): string {
    const n = typeof name === 'string' ? name.trim() : '';
    return n ? `the project “${n}”` : 'this project';
  }

  archiveProject(event: { id: number; archived: boolean; name?: string; nativeEvent: Event }) {
    const action = event.archived ? 'Archive' : 'Unarchive';
    const phrase = this.projectConfirmPhrase(event.name);

    this.confirmationService.confirm({
      target: event.nativeEvent.target as EventTarget,
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

        this.projectService.archiveProject(event.id, event.archived).subscribe({
          next: () => {
            this.refresh$.next();
            this.notify(
              'info',
              `${action}d`,
              event.archived
                ? 'Project archived. You can open it again from Archived projects.'
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

  pauseProject(event: { id: number; paused: boolean; name?: string; nativeEvent: Event }): void {
    const action = event.paused ? 'pause' : 'resume';
    const phrase = this.projectConfirmPhrase(event.name);
    this.confirmationService.confirm({
      target: event.nativeEvent.target as EventTarget,
      message: event.paused
        ? `Are you sure you want to pause ${phrase}? The team can still view it; task changes should follow your internal process.`
        : `Are you sure you want to resume ${phrase} and clear the paused state?`,
      header: event.paused ? 'Pause project' : 'Resume project',
      icon: 'pi pi-info-circle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: event.paused ? 'Pause' : 'Resume', severity: 'warning' },
      accept: () => {
        this.projectService.setProjectLifecycle(event.id, { status: event.paused ? 'PAUSED' : 'IN_PROGRESS' }).subscribe({
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

  deliverProject(event: { id: number; delivered: boolean; name?: string; nativeEvent: Event }): void {
    const phrase = this.projectConfirmPhrase(event.name);
    this.confirmationService.confirm({
      target: event.nativeEvent.target as EventTarget,
      message: event.delivered
        ? `Are you sure you want to deliver ${phrase} (mark it as closed for delivery tracking)?`
        : `Are you sure you want to reopen ${phrase} and clear the delivered state?`,
      header: event.delivered ? 'Mark as delivered' : 'Reopen project',
      icon: 'pi pi-info-circle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: event.delivered ? 'Mark delivered' : 'Reopen', severity: 'success' },
      accept: () => {
        this.projectService.setProjectLifecycle(event.id, { status: event.delivered ? 'COMPLETED' : 'IN_PROGRESS' }).subscribe({
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
