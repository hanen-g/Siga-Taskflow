import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { UserService, AdminUser } from '../../../services/user.service';
import { UserDirectoryRefreshService } from '../../../services/user-directory-refresh.service';
import { ProfilePictureCacheService } from '../../../services/profile-picture-cache.service';

type ClientGender = 'FEMALE' | 'MALE' | 'OTHER' | '';

@Component({
  selector: 'app-create-client-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    AvatarModule,
    ButtonModule,
    MessageModule,
    ToastModule,
    TextareaModule,
    DialogModule
  ],
  templateUrl: './create-client.html',
  styleUrls: ['./create-client.css'],
  providers: [MessageService]
})
export class CreateClientPage implements OnInit, OnDestroy {
  private readonly clientsPageSize = 8;
  private readonly destroy$ = new Subject<void>();

  form = {
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: '' as string,
    gender: '' as ClientGender,
    recruitmentDate: '' as string,
    company: '',
    fiscalMatricule: '',
    address: ''
  };
  createLoading = false;
  tableLoading = false;
  createError: string | null = null;

  /** List filter (name, email, phone, company) */
  clientSearchQuery = '';
  /** Local pagination for “Load more” */
  clientsVisibleCount = this.clientsPageSize;

  /** Active + former (deactivated) accounts merged, newest first */
  clients: AdminUser[] = [];

  private readonly statusSavingIds = new Set<number>();

  /** Clients matching the search field */
  get filteredClients(): AdminUser[] {
    const q = this.clientSearchQuery.trim().toLowerCase();
    if (!q) return this.clients;
    return this.clients.filter((c) => {
      const hay = [c.firstName, c.lastName, c.email, c.phoneNumber ?? '', c.company ?? '']
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  /** Slice shown in the right column */
  get displayedClients(): AdminUser[] {
    return this.filteredClients.slice(0, this.clientsVisibleCount);
  }

  get showLoadMore(): boolean {
    return this.filteredClients.length > this.clientsVisibleCount;
  }

  get hasNoSearchResults(): boolean {
    return !this.tableLoading && this.clients.length > 0 && this.filteredClients.length === 0;
  }

  /** Selected row — details in dialog */
  selectedClient: AdminUser | null = null;
  detailDialogVisible = false;

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
    company: '',
    fiscalMatricule: '',
    address: ''
  };

  constructor(
    private userService: UserService,
    private messageService: MessageService,
    private userDirectoryRefresh: UserDirectoryRefreshService,
    private profilePictureCache: ProfilePictureCacheService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadClients();
    this.userDirectoryRefresh.directoryShouldRefresh$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.profilePictureCache.revokeAll();
        this.loadClients();
      });
    this.profilePictureCache.imageReady.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.profilePictureCache.revokeAll();
  }

  getClientProfilePictureSrc(profilePicture?: string | null): string | undefined {
    return this.profilePictureCache.getDisplayUrl(profilePicture);
  }

  /**
   * PrimeNG Avatar shows {@code label} before {@code image}; if label is always set, the photo never appears.
   */
  getClientAvatarLabel(c: AdminUser): string | undefined {
    return this.getClientProfilePictureSrc(c.profilePicture) ? undefined : this.getClientInitials(c);
  }

  getClientInitials(c: AdminUser): string {
    const first = c.firstName?.charAt(0) ?? '';
    const last = c.lastName?.charAt(0) ?? '';
    return `${first}${last}`.toUpperCase() || 'U';
  }

  loadClients(): void {
    this.tableLoading = true;
    forkJoin({
      active: this.userService.getAdminUsers('', 'CLIENT', 'active'),
      former: this.userService.getAdminUsers('', 'CLIENT', 'former')
    })
      .pipe(
        map(({ active, former }) => {
          const merged = [...(active ?? []), ...(former ?? [])];
          const byId = new Map<number, AdminUser>();
          for (const u of merged) {
            byId.set(u.id, u);
          }
          return [...byId.values()].sort((a, b) =>
            String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
          );
        })
      )
      .subscribe({
        next: (list) => {
          this.clients = list;
          this.tableLoading = false;
          this.clientsVisibleCount = this.clientsPageSize;
        },
        error: () => {
          this.tableLoading = false;
          this.clients = [];
        }
      });
  }

  private resetForm(): void {
    this.form = {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      dateOfBirth: '',
      gender: '',
      recruitmentDate: '',
      company: '',
      fiscalMatricule: '',
      address: ''
    };
  }

  onClientSearchChange(): void {
    this.clientsVisibleCount = this.clientsPageSize;
  }

  loadMoreClients(): void {
    this.clientsVisibleCount += this.clientsPageSize;
  }

  /** Plain read-only detail display */
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

  formatDate(val: string | null | undefined): string {
    if (!val) return '—';
    const d = val.includes('T') ? val.split('T')[0] : String(val).slice(0, 10);
    if (!d || d.length < 10) return '—';
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

  openClientDetail(c: AdminUser): void {
    this.detailEditing = false;
    this.detailEditError = null;
    this.selectedClient = c;
    this.detailDialogVisible = true;
  }

  openCardOnSpacebar(ev: Event, c: AdminUser): void {
    ev.preventDefault();
    this.openClientDetail(c);
  }

  onDetailHide(): void {
    this.detailEditing = false;
    this.detailEditError = null;
    this.selectedClient = null;
  }

  startDetailEdit(): void {
    const d = this.selectedClient;
    if (!d) return;
    this.detailEditError = null;
    this.detailEditForm = {
      firstName: d.firstName ?? '',
      lastName: d.lastName ?? '',
      email: d.email ?? '',
      phoneNumber: d.phoneNumber ?? '',
      dateOfBirth: this.apiDateToInput(d.dateOfBirth),
      gender: (d.gender as ClientGender) || '',
      company: d.company ?? '',
      fiscalMatricule: d.fiscalMatricule ?? '',
      address: d.address ?? ''
    };
    this.detailEditing = true;
  }

  cancelDetailEdit(): void {
    this.detailEditing = false;
    this.detailEditError = null;
  }

  private apiDateToInput(api: string | null | undefined): string {
    if (!api) return '';
    const s = api.includes('T') ? String(api.split('T')[0]) : String(api).slice(0, 10);
    return s.length >= 10 ? s : '';
  }

  saveDetailProfile(): void {
    const d = this.selectedClient;
    if (!d || this.detailSaveLoading) return;

    const f = this.detailEditForm;
    this.detailEditError = null;

    if (!f.firstName?.trim() || !f.lastName?.trim() || !f.email?.trim()) {
      this.detailEditError = 'Enter first name, last name, and email.';
      return;
    }
    if (!f.phoneNumber?.trim()) {
      this.detailEditError = 'Enter the phone number.';
      return;
    }
    if (!f.dateOfBirth?.trim()) {
      this.detailEditError = 'Enter the date of birth.';
      return;
    }
    if (!f.gender?.trim()) {
      this.detailEditError = 'Select a gender.';
      return;
    }
    if (!f.company?.trim()) {
      this.detailEditError = 'Enter the company name.';
      return;
    }
    if (!f.fiscalMatricule?.trim()) {
      this.detailEditError = 'Enter the tax ID.';
      return;
    }
    if (!f.address?.trim()) {
      this.detailEditError = 'Enter the address.';
      return;
    }

    this.detailSaveLoading = true;
    this.userService
      .updateAdminUser(d.id, {
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim(),
        email: f.email.trim().toLowerCase(),
        role: 'CLIENT',
        phoneNumber: f.phoneNumber.trim(),
        address: f.address.trim(),
        dateOfBirth: f.dateOfBirth.trim(),
        gender: f.gender.trim(),
        company: f.company.trim(),
        fiscalMatricule: f.fiscalMatricule.trim()
      })
      .subscribe({
        next: (updated) => {
          this.detailSaveLoading = false;
          const row = this.clients.find((u) => u.id === updated.id);
          if (row) {
            Object.assign(row, updated);
          }
          if (this.selectedClient?.id === updated.id) {
            Object.assign(this.selectedClient, updated);
          }
          this.detailEditing = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Profile updated',
            detail: 'The client details were saved.',
            life: 2200
          });
        },
        error: (err) => {
          this.detailSaveLoading = false;
          const msg = err?.error?.message;
          this.detailEditError = typeof msg === 'string' ? msg : 'Could not save the profile.';
        }
      });
  }

  clientDetailHeader(): string {
    const c = this.selectedClient;
    if (!c) {
      return 'Client details';
    }
    const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
    return name || 'Client details';
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
          detail: updated.active ? 'The account is active.' : 'The account is inactive.',
          life: 2000
        });
      },
      error: () => {
        c.active = prev;
        this.statusSavingIds.delete(id);
        this.messageService.add({
          severity: 'error',
          summary: 'Failed',
          detail: 'Could not update account status.',
          life: 3500
        });
      }
    });
  }

  submit(): void {
    this.createError = null;

    if (!this.form.firstName?.trim() || !this.form.lastName?.trim() || !this.form.email?.trim()) {
      this.createError = 'Enter first name, last name, and email.';
      return;
    }
    if (!this.form.phoneNumber?.trim()) {
      this.createError = 'Enter the phone number.';
      return;
    }
    if (!this.form.dateOfBirth?.trim()) {
      this.createError = 'Enter the date of birth.';
      return;
    }
    if (!this.form.gender?.trim()) {
      this.createError = 'Select a gender.';
      return;
    }
    if (!this.form.company?.trim()) {
      this.createError = 'Enter the company name.';
      return;
    }
    if (!this.form.fiscalMatricule?.trim()) {
      this.createError = 'Enter the tax ID.';
      return;
    }
    if (!this.form.address?.trim()) {
      this.createError = 'Enter the address.';
      return;
    }

    this.createLoading = true;
    this.userService
      .createAdminUser({
        firstName: this.form.firstName.trim(),
        lastName: this.form.lastName.trim(),
        email: this.form.email.trim().toLowerCase(),
        role: 'CLIENT',
        skillIds: [],
        phoneNumber: this.form.phoneNumber.trim(),
        address: this.form.address.trim(),
        dateOfBirth: this.form.dateOfBirth.trim(),
        active: false,
        gender: this.form.gender.trim(),
        company: this.form.company.trim(),
        fiscalMatricule: this.form.fiscalMatricule.trim()
      })
      .subscribe({
        next: (res) => {
          this.createLoading = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Client created',
            detail: res?.message ?? 'Client account saved.',
            life: 2000
          });
          this.resetForm();
          this.loadClients();
        },
        error: (err) => {
          this.createLoading = false;
          const msg = err?.error?.message;
          this.createError = typeof msg === 'string' ? msg : 'Could not create the client account.';
        }
      });
  }
}
