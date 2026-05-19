import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { UserService, AdminUser } from '../../../services/user.service';
import { ClientProjectRow, ProjectService } from '../../../services/project.service';
import { ClientLabelColorPickerComponent } from './client-label-color-picker';
import { DEFAULT_CLIENT_LABEL_COLOR, resolvedClientLabelColor } from './client-label-colors';

type ClientGender = 'FEMALE' | 'MALE' | 'OTHER' | '';

type RightPanelMode = 'form' | 'profile';
type ListStatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-create-client-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
    ToastModule,
    TextareaModule,
    MultiSelectModule,
    SelectModule,
    ClientLabelColorPickerComponent,
  ],
  templateUrl: './create-client.html',
  styleUrls: ['./create-client.css'],
  providers: [MessageService],
})
export class CreateClientPage implements OnInit {
  readonly statusOptions: { label: string; value: boolean }[] = [
    { label: 'Active', value: true },
    { label: 'Inactive', value: false },
  ];

  form = {
    company: '',
    fiscalMatricule: '',
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    address: '',
    gender: '' as ClientGender,
    active: true,
    clientLabelColor: DEFAULT_CLIENT_LABEL_COLOR,
  };
  selectedProjectIds: number[] = [];
  projectOptions: { label: string; value: number }[] = [];

  createLoading = false;
  tableLoading = false;
  projectsCatalogLoading = false;
  createError: string | null = null;

  clients: AdminUser[] = [];

  private readonly statusSavingIds = new Set<number>();

  listSearch = '';
  listStatusFilter: ListStatusFilter = 'all';
  nameSortAsc = true;

  rightPanelMode: RightPanelMode = 'form';
  selectedClient: AdminUser | null = null;

  profileProjects: ClientProjectRow[] = [];
  profileProjectsLoading = false;

  detailEditing = false;
  detailSaveLoading = false;
  detailEditError: string | null = null;
  detailEditForm = {
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: '' as string,
    gender: '' as ClientGender,
    recruitmentDate: '' as string,
    company: '',
    fiscalMatricule: '',
    address: '',
    clientLabelColor: DEFAULT_CLIENT_LABEL_COLOR,
  };
  /** Project ids selected for the currently-edited client (active projects only). */
  detailEditProjectIds: number[] = [];
  /** Snapshot used to detect whether the project list changed during the edit session. */
  private detailEditInitialProjectIds: number[] = [];

  constructor(
    private userService: UserService,
    private projectService: ProjectService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadClients();
    this.loadProjectCatalog();
  }

  get filteredClients(): AdminUser[] {
    let list = [...this.clients];
    const q = this.listSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const company = (c.company ?? '').toLowerCase();
        const email = (c.email ?? '').toLowerCase();
        const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim().toLowerCase();
        const fiscal = (c.fiscalMatricule ?? '').toLowerCase();
        return company.includes(q) || email.includes(q) || name.includes(q) || fiscal.includes(q);
      });
    }
    if (this.listStatusFilter === 'active') {
      list = list.filter((c) => c.active);
    } else if (this.listStatusFilter === 'inactive') {
      list = list.filter((c) => !c.active);
    }

    const dir = this.nameSortAsc ? 1 : -1;
    list.sort((a, b) => {
      const na = this.clientFullName(a).toLowerCase();
      const nb = this.clientFullName(b).toLowerCase();
      if (na !== nb) {
        return na < nb ? -dir : dir;
      }
      return (a.company ?? '').localeCompare(b.company ?? '', undefined, { sensitivity: 'base' });
    });
    return list;
  }

  loadClients(): void {
    this.tableLoading = true;
    forkJoin({
      active: this.userService.getAdminUsers('', 'CLIENT', 'active'),
      former: this.userService.getAdminUsers('', 'CLIENT', 'former'),
    })
      .pipe(
        map(({ active, former }) => {
          const merged = [...(active ?? []), ...(former ?? [])];
          const byId = new Map<number, AdminUser>();
          for (const u of merged) {
            byId.set(u.id, u);
          }
          return [...byId.values()].sort((a, b) =>
            String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')),
          );
        }),
      )
      .subscribe({
        next: (list) => {
          this.clients = list;
          this.tableLoading = false;
          if (this.selectedClient) {
            const fresh = list.find((u) => u.id === this.selectedClient!.id);
            if (fresh) {
              this.selectedClient = fresh;
            }
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.tableLoading = false;
          this.clients = [];
          this.cdr.markForCheck();
        },
      });
  }

  loadProjectCatalog(): void {
    this.projectsCatalogLoading = true;
    this.projectService.getAllProjects().subscribe({
      next: (list) => {
        this.projectsCatalogLoading = false;
        this.projectOptions = (list ?? [])
          .map((p) => ({
            label: (p.name as string)?.trim() || `Project #${p.id}`,
            value: p.id as number,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
        this.cdr.markForCheck();
      },
      error: () => {
        this.projectsCatalogLoading = false;
        this.projectOptions = [];
        this.cdr.markForCheck();
      },
    });
  }

  showNewClientForm(): void {
    this.selectedClient = null;
    this.rightPanelMode = 'form';
    this.detailEditing = false;
    this.detailEditError = null;
    this.profileProjects = [];
  }

  clientLabelColorFor(c: Pick<AdminUser, 'clientLabelColor'>): string {
    return resolvedClientLabelColor(c.clientLabelColor);
  }

  selectClient(c: AdminUser): void {
    this.detailEditing = false;
    this.detailEditError = null;
    this.selectedClient = c;
    this.rightPanelMode = 'profile';
    this.loadProfileProjects(c.id);
  }

  

  loadProfileProjects(clientId: number): void {
    this.profileProjectsLoading = true;
    this.profileProjects = [];
    this.projectService.getProjectsForClient(clientId).subscribe({
      next: (rows) => {
        this.profileProjects = rows ?? [];
        this.profileProjectsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.profileProjectsLoading = false;
        this.profileProjects = [];
        this.cdr.markForCheck();
      },
    });
  }

  toggleNameSort(): void {
    this.nameSortAsc = !this.nameSortAsc;
  }

  clientFullName(c: Pick<AdminUser, 'firstName' | 'lastName'>): string {
    const n = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
    return n || '—';
  }

  cycleListFilter(): void {
    const order: ListStatusFilter[] = ['all', 'active', 'inactive'];
    const i = order.indexOf(this.listStatusFilter);
    this.listStatusFilter = order[(i + 1) % order.length];
  }

  filterIconClass(): string {
    switch (this.listStatusFilter) {
      case 'active':
        return 'pi pi-filter-fill';
      case 'inactive':
        return 'pi pi-filter-slash';
      default:
        return 'pi pi-filter';
    }
  }

  filterTooltip(): string {
    switch (this.listStatusFilter) {
      case 'active':
        return 'Filter: Active only — click to change';
      case 'inactive':
        return 'Filter: Inactive only — click to change';
      default:
        return 'Filter: All clients — click to change';
    }
  }

  private resetForm(): void {
    this.form = {
      company: '',
      fiscalMatricule: '',
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      address: '',
      gender: '' as ClientGender,
      active: true,
      clientLabelColor: DEFAULT_CLIENT_LABEL_COLOR,
    };
    this.selectedProjectIds = [];
    this.createError = null;
  }

  clearForm(): void {
    if (this.createLoading) {
      return;
    }
    this.resetForm();
  }

  formatAddressPlain(blob: string | null | undefined): string {
    const t = (blob ?? '').trim();
    return t ? t.replace(/\s+$/, '') : '—';
  }

  genderLabel(code: string | null | undefined): string {
    switch (code) {
      case 'FEMALE':
        return 'Female';
      case 'MALE':
        return 'Male';
      case 'OTHER':
        return 'Other';
      default:
        return '—';
    }
  }

  formatDeadline(val: string | null | undefined): string {
    if (!val) {
      return '—';
    }
    const d = val.includes('T') ? val.split('T')[0] : String(val).slice(0, 10);
    if (!d || d.length < 10) {
      return '—';
    }
    try {
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    } catch {
      return val;
    }
  }

  isSavingStatus(id: number): boolean {
    return this.statusSavingIds.has(id);
  }

  avatarInitials(c: Pick<AdminUser, 'firstName' | 'lastName'>): string {
    const f = (c.firstName ?? '').trim()[0] ?? '';
    const l = (c.lastName ?? '').trim()[0] ?? '';
    const s = (f + l).toUpperCase();
    return s || '?';
  }


  profileBannerName(): string {
    const c = this.selectedClient;
    if (!c) {
      return '';
    }
    return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '—';
  }

  sendEmail(): void {
    const e = this.selectedClient?.email;
    if (e) {
      window.location.href = `mailto:${encodeURIComponent(e)}`;
    }
  }

  printProfile(): void {
    window.print();
  }

  startDetailEdit(): void {
    const d = this.selectedClient;
    if (!d) {
      return;
    }
    this.detailEditError = null;
    this.detailEditForm = {
      firstName: d.firstName ?? '',
      lastName: d.lastName ?? '',
      email: d.email ?? '',
      phoneNumber: d.phoneNumber ?? '',
      dateOfBirth: this.apiDateToInput(d.dateOfBirth),
      gender: (d.gender as ClientGender) || '',
      recruitmentDate: this.apiDateToInput(d.recruitmentDate),
      company: d.company ?? '',
      fiscalMatricule: d.fiscalMatricule ?? '',
      address: d.address ?? '',
      clientLabelColor: resolvedClientLabelColor(d.clientLabelColor),
    };
    const projectIds = (this.profileProjects ?? [])
      .map((p) => p.id)
      .filter((id): id is number => typeof id === 'number');
    this.detailEditProjectIds = [...projectIds];
    this.detailEditInitialProjectIds = [...projectIds];
    this.detailEditing = true;
  }

  cancelDetailEdit(): void {
    this.detailEditing = false;
    this.detailEditError = null;
    this.detailEditProjectIds = [...this.detailEditInitialProjectIds];
  }

  private apiDateToInput(api: string | null | undefined): string {
    if (!api) {
      return '';
    }
    const s = api.includes('T') ? String(api.split('T')[0]) : String(api).slice(0, 10);
    return s.length >= 10 ? s : '';
  }

  saveDetailProfile(): void {
    const d = this.selectedClient;
    if (!d || this.detailSaveLoading) {
      return;
    }

    const f = this.detailEditForm;
    this.detailEditError = null;

    if (!f.firstName?.trim() || !f.lastName?.trim() || !f.email?.trim()) {
      this.detailEditError = 'First name, last name and email are required.';
      return;
    }

    this.detailSaveLoading = true;
    this.userService
      .updateUser(d.id, {
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim(),
        email: f.email.trim().toLowerCase(),
        role: 'CLIENT',
        phoneNumber: f.phoneNumber?.trim() || undefined,
        address: f.address?.trim() || undefined,
        dateOfBirth: f.dateOfBirth?.trim() || undefined,
        gender: f.gender?.trim() || undefined,
        recruitmentDate: f.recruitmentDate?.trim() || undefined,
        company: f.company?.trim() || undefined,
        fiscalMatricule: f.fiscalMatricule?.trim() || undefined,
        clientLabelColor: f.clientLabelColor,
      })
      .subscribe({
        next: (updated) => {
          const row = this.clients.find((u) => u.id === updated.id);
          if (row) {
            Object.assign(row, updated);
          }
          if (this.selectedClient?.id === updated.id) {
            Object.assign(this.selectedClient, updated);
          }
          this.persistDetailProjectsIfChanged(updated.id);
        },
        error: (err) => {
          this.detailSaveLoading = false;
          const msg = err?.error?.message;
          this.detailEditError = typeof msg === 'string' ? msg : 'Could not save profile.';
          this.cdr.markForCheck();
        },
      });
  }

  private persistDetailProjectsIfChanged(clientId: number): void {
    const next = [...this.detailEditProjectIds].sort((a, b) => a - b);
    const prev = [...this.detailEditInitialProjectIds].sort((a, b) => a - b);
    const same = next.length === prev.length && next.every((id, i) => id === prev[i]);
    if (same) {
      this.completeDetailSave(clientId, true);
      return;
    }
    this.projectService.setClientProjects(clientId, next).subscribe({
      next: () => this.completeDetailSave(clientId, true),
      error: (err) => {
        const msg = err?.error?.message;
        this.completeDetailSave(clientId, false, typeof msg === 'string' ? msg : undefined);
      },
    });
  }

  private completeDetailSave(clientId: number, projectsOk: boolean, projectsErr?: string): void {
    this.detailSaveLoading = false;
    this.detailEditing = false;
    this.detailEditInitialProjectIds = [...this.detailEditProjectIds];
    this.loadProfileProjects(clientId);
    this.messageService.add({
      severity: 'success',
      summary: 'Profile updated',
      detail: 'Client details were saved.',
      life: 2200,
    });
    if (!projectsOk) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Projects',
        detail: projectsErr ?? 'Profile saved, but project assignments could not be updated.',
        life: 5000,
      });
    }
    this.cdr.markForCheck();
  }

  onClientStatusToggle(c: AdminUser, nextActive: boolean): void {
    const id = c.id;
    if (this.statusSavingIds.has(id) || c.active === nextActive) {
      return;
    }

    const prev = c.active;
    c.active = nextActive;
    this.statusSavingIds.add(id);
    this.userService.updateUserStatus(id, nextActive).subscribe({
      next: (updated) => {
        c.active = updated.active;
        this.statusSavingIds.delete(id);
        this.messageService.add({
          severity: 'success',
          summary: 'Status updated',
          detail: updated.active ? 'Account is active.' : 'Account is inactive.',
          life: 2000,
        });
        this.cdr.markForCheck();
      },
      error: () => {
        c.active = prev;
        this.statusSavingIds.delete(id);
        this.messageService.add({
          severity: 'error',
          summary: 'Failed',
          detail: 'Could not update account status.',
          life: 3500,
        });
        this.cdr.markForCheck();
      },
    });
  }

  submit(): void {
    this.createError = null;

    if (!this.form.company?.trim()) {
      this.createError = 'Company name is required.';
      return;
    }
    if (!this.form.firstName?.trim() || !this.form.lastName?.trim() || !this.form.email?.trim()) {
      this.createError = 'First name, last name and email are required.';
      return;
    }
    if (!this.form.phoneNumber?.trim()) {
      this.createError = 'Phone number is required.';
      return;
    }
    if (!this.form.address?.trim()) {
      this.createError = 'Address is required.';
      return;
    }

    this.createLoading = true;
    const fiscal = this.form.fiscalMatricule?.trim();
    this.userService
      .createAdminUser({
        firstName: this.form.firstName.trim(),
        lastName: this.form.lastName.trim(),
        email: this.form.email.trim().toLowerCase(),
        role: 'CLIENT',
        skillIds: [],
        phoneNumber: this.form.phoneNumber.trim(),
        address: this.form.address.trim(),
        active: this.form.active,
        company: this.form.company.trim(),
        clientLabelColor: this.form.clientLabelColor,
        ...(this.form.gender ? { gender: this.form.gender } : {}),
        ...(fiscal ? { fiscalMatricule: fiscal } : {}),
      })
      .subscribe({
        next: (res) => {
          const newUser = res.user;
          const projectIds = [...this.selectedProjectIds];
          const finishSuccess = (assignOk: boolean, assignErr?: string) => {
            this.createLoading = false;
            this.messageService.add({
              severity: res.emailSent ? 'success' : 'warn',
              summary: res.emailSent ? 'Client created' : 'Client created (email not sent)',
              detail: res?.message ?? 'Account saved.',
              life: res.emailSent ? 3200 : 12000,
            });
            if (projectIds.length && !assignOk) {
              this.messageService.add({
                severity: 'warn',
                summary: 'Projects',
                detail: assignErr ?? 'Client was created but project assignment failed.',
                life: 5000,
              });
            }
            this.resetForm();
            this.clients = [newUser, ...this.clients.filter((u) => u.id !== newUser.id)];
            this.selectClient(newUser);
            this.cdr.markForCheck();
          };

          if (projectIds.length === 0) {
            finishSuccess(true);
            return;
          }

          this.projectService.setClientProjects(newUser.id, projectIds).subscribe({
            next: () => finishSuccess(true),
            error: (err) => {
              const msg = err?.error?.message;
              finishSuccess(false, typeof msg === 'string' ? msg : undefined);
            },
          });
        },
        error: (err) => {
          this.createLoading = false;
          const msg = err?.error?.message;
          this.createError = typeof msg === 'string' ? msg : 'Could not create client account.';
          this.cdr.markForCheck();
        },
      });
  }

  listRowActivate(event: Event, c: AdminUser): void {
    const kb = event as KeyboardEvent;
    if (kb.key === 'Enter' || kb.key === ' ') {
      kb.preventDefault();
      this.selectClient(c);
    }
  }
}
