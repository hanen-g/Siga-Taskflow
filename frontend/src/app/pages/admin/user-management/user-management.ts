import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { forkJoin, merge, Observable, of, Subject } from 'rxjs';
import { catchError, finalize, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import {
  AdminUser,
  CreateUserRole,
  EmployeeRole,
  EmployeeStatusFilter,
  UserService
} from '../../../services/user.service';
import { FileAccessService } from '../../../services/file-access.service';
import { Skill } from '../../../models/skill.model';
import { SkillService } from '../../../services/skill.service';

type ListStatusFilter = 'all' | EmployeeStatusFilter;
type EmployeeGender = '' | 'FEMALE' | 'MALE' | 'OTHER';
type AvatarFamily = 'green' | 'blue' | 'purple' | 'amber';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    SelectModule,
    ButtonModule,
    DialogModule,
    MultiSelectModule,
    TextareaModule
  ],
  templateUrl: './user-management.html',
  styleUrls: ['./user-management.css']
})
export class UserManagementPage implements OnInit, OnDestroy {
  users: AdminUser[] = [];
  loadingUsers = false;
  error: string | null = null;
  private readonly refresh$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();
  private readonly profilePictureUrls = new Map<string, string>();
  private readonly profilePicturesLoading = new Set<string>();
  private searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  searchTerm = '';
  selectedRole: EmployeeRole = 'ALL';
  roleLocked = false;
  listStatusFilter: ListStatusFilter = 'active';

  readonly listFilterOptions: { label: string; value: ListStatusFilter }[] = [
    { label: 'All users', value: 'all' },
    { label: 'Active employees', value: 'active' },
    { label: 'Inactive employees', value: 'former' }
  ];

  readonly editRoleOptions: { label: string; value: Exclude<EmployeeRole, 'ALL' | 'CLIENT'> | 'ADMIN' }[] = [
    { label: 'Project Manager', value: 'PROJECT_MANAGER' },
    { label: 'Collaborator', value: 'COLLABORATOR' },
    { label: 'Admin', value: 'ADMIN' }
  ];

  private readonly accountCreatedFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  editDialogVisible = false;
  statusDialogVisible = false;
  selectedUser: AdminUser | null = null;
  detailUser: AdminUser | null = null;

  editForm = {
    firstName: '',
    lastName: '',
    email: '',
    role: 'COLLABORATOR' as Exclude<EmployeeRole, 'ALL'> | 'ADMIN',
    skillIds: [] as number[],
    phoneNumber: '',
    address: '',
    gender: '' as EmployeeGender
  };

  readonly genderOptions: { label: string; value: EmployeeGender }[] = [
    { label: '—', value: '' },
    { label: 'Female', value: 'FEMALE' },
    { label: 'Male', value: 'MALE' },
    { label: 'Other', value: 'OTHER' }
  ];
  allSkills: Skill[] = [];
  skillsLoading = false;

  ngOnInit(): void {
    merge(
      this.route.queryParamMap.pipe(
        tap((params) => this.applyRoleFromQuery(params)),
        map(() => undefined)
      ),
      this.refresh$
    )
      .pipe(
        switchMap(() => {
          this.loadingUsers = true;
          this.error = null;
          return this.fetchUserList().pipe(
            tap((list) => {
              this.users = list;
            }),
            finalize(() => {
              this.loadingUsers = false;
              this.cdr.markForCheck();
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  constructor(
    private readonly userService: UserService,
    private readonly fileAccessService: FileAccessService,
    private readonly cdr: ChangeDetectorRef,
    private readonly skillService: SkillService,
    private readonly route: ActivatedRoute
  ) {}

  private applyRoleFromQuery(params: ParamMap): void {
    const role = params.get('role');
    if (role === 'ADMIN' || role === 'COLLABORATOR' || role === 'PROJECT_MANAGER') {
      this.selectedRole = role;
      this.roleLocked = true;
      return;
    }
    this.selectedRole = 'ALL';
    this.roleLocked = false;
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.destroy$.next();
    this.destroy$.complete();
    for (const objectUrl of this.profilePictureUrls.values()) {
      URL.revokeObjectURL(objectUrl);
    }
    this.profilePictureUrls.clear();
    this.profilePicturesLoading.clear();
  }

  loadUsers(): void {
    this.refresh$.next();
  }

  onFiltersChange(): void {
    this.loadUsers();
  }

  onSearchChange(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.searchDebounceTimer = undefined;
      this.loadUsers();
    }, 280);
  }

  roleLabel(role: string): string {
    if (role === 'PROJECT_MANAGER') return 'Project Manager';
    if (role === 'COLLABORATOR') return 'Collaborator';
    if (role === 'ADMIN') return 'Admin';
    if (role === 'CLIENT') return 'Client';
    return role.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
  }

  avatarFamily(user: AdminUser): AvatarFamily {
    switch (user.role) {
      case 'COLLABORATOR':
        return 'green';
      case 'ADMIN':
        return 'amber';
      case 'PROJECT_MANAGER':
        return 'blue';
      case 'CLIENT':
      default:
        return 'purple';
    }
  }

  genderLabel(gender: string | null | undefined): string {
    const g = (gender ?? '').toUpperCase();
    if (g === 'FEMALE') return 'Female';
    if (g === 'MALE') return 'Male';
    if (g === 'OTHER') return 'Other';
    return '—';
  }

  skillsSummary(user: AdminUser): string {
    const names = (user.skills ?? []).map((s) => s.name).filter(Boolean);
    return names.length ? names.join(', ') : '—';
  }

  memberSinceLabel(user: AdminUser): string {
    if (!user.createdAt) {
      return 'Not available';
    }

    const parsedDate = new Date(user.createdAt);

    if (Number.isNaN(parsedDate.getTime())) {
      return 'Not available';
    }

    return this.accountCreatedFormatter.format(parsedDate);
  }

  getUserInitials(user: AdminUser): string {
    const first = user.firstName?.charAt(0) ?? '';
    const last = user.lastName?.charAt(0) ?? '';
    return `${first}${last}`.toUpperCase() || 'U';
  }

  getProfilePictureSrc(profilePicture?: string | null): string | undefined {
    if (!profilePicture) {
      return undefined;
    }

    if (
      profilePicture.startsWith('blob:') ||
      profilePicture.startsWith('data:') ||
      profilePicture.startsWith('http')
    ) {
      return profilePicture;
    }

    const cachedUrl = this.profilePictureUrls.get(profilePicture);
    if (cachedUrl) {
      return cachedUrl;
    }

    if (!this.profilePicturesLoading.has(profilePicture)) {
      this.profilePicturesLoading.add(profilePicture);
      this.fileAccessService.fetchFileBlob(profilePicture).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.profilePicturesLoading.delete(profilePicture);
          setTimeout(() => {
            this.profilePictureUrls.set(profilePicture, url);
            this.cdr.markForCheck();
          }, 0);
        },
        error: () => {
          this.profilePicturesLoading.delete(profilePicture);
        }
      });
    }

    return undefined;
  }

  openUserDetail(user: AdminUser): void {
    this.detailUser = user;
  }

  closeUserDetail(): void {
    this.detailUser = null;
  }

  onDetailBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeUserDetail();
    }
  }

  fromDetailEdit(): void {
    if (!this.detailUser) {
      return;
    }
    const u = this.detailUser;
    this.closeUserDetail();
    this.openEditDialog(u);
  }

  fromDetailDeactivate(): void {
    if (!this.detailUser) {
      return;
    }
    const u = this.detailUser;
    this.closeUserDetail();
    this.openStatusDialog(u);
  }

  openEditDialog(user: AdminUser): void {
    this.selectedUser = user;
    const g = (user.gender ?? '').toUpperCase();
    const gender: EmployeeGender =
      g === 'FEMALE' || g === 'MALE' || g === 'OTHER' ? (g as EmployeeGender) : '';
    this.editForm = {
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email ?? '',
      role: user.role === 'CLIENT' ? 'COLLABORATOR' : user.role,
      skillIds: (user.skills ?? []).map((s) => s.id),
      phoneNumber: user.phoneNumber ?? '',
      address: user.address ?? '',
      gender
    };
    if (this.roleSupportsSkills(this.editForm.role)) {
      this.loadSkillsIfNeeded();
    }
    this.editDialogVisible = true;
  }

  showsEmployeeProfile(role: string): boolean {
    return role === 'ADMIN' || role === 'PROJECT_MANAGER' || role === 'COLLABORATOR';
  }

  saveUserEdits(): void {
    if (!this.selectedUser) {
      return;
    }

    const r = this.editForm.role;
    const basePayload = {
      firstName: this.editForm.firstName,
      lastName: this.editForm.lastName,
      email: this.editForm.email,
      role: r as CreateUserRole,
      skillIds: this.roleSupportsSkills(r) ? this.editForm.skillIds : []
    };
    const profilePayload = this.showsEmployeeProfile(r)
      ? {
          phoneNumber: (this.editForm.phoneNumber ?? '').trim(),
          address: (this.editForm.address ?? '').trim(),
          gender: (this.editForm.gender ?? '').trim()
        }
      : {};

    this.userService.updateUser(this.selectedUser.id, { ...basePayload, ...profilePayload }).subscribe({
      next: () => {
        this.editDialogVisible = false;
        this.selectedUser = null;
        this.loadUsers();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to update user.';
      }
    });
  }

  roleSupportsSkills(role: string): boolean {
    return role === 'PROJECT_MANAGER' || role === 'COLLABORATOR';
  }

  onEditRoleChange(): void {
    if (!this.roleSupportsSkills(this.editForm.role)) {
      this.editForm.skillIds = [];
      return;
    }
    this.loadSkillsIfNeeded();
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
        this.error = 'Could not load skills catalog.';
      }
    });
  }

  openStatusDialog(user: AdminUser): void {
    this.selectedUser = user;
    this.statusDialogVisible = true;
  }

  accountLabelForConfirm(user: AdminUser): string {
    const parts = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    if (parts) {
      return `“${parts}”`;
    }
    return user.email ? `“${user.email}”` : 'this user';
  }

  confirmToggleStatus(): void {
    if (!this.selectedUser) {
      return;
    }

    this.userService.updateUserStatus(this.selectedUser.id, !this.selectedUser.active).subscribe({
      next: () => {
        this.statusDialogVisible = false;
        this.selectedUser = null;
        this.loadUsers();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to update employee status.';
      }
    });
  }

  private fetchUserList(): Observable<AdminUser[]> {
    const search = this.searchTerm;
    const role = this.selectedRole;

    if (this.listStatusFilter === 'all') {
      return forkJoin({
        active: this.userService.getAdminUsers(search, role, 'active').pipe(catchError(() => of([] as AdminUser[]))),
        former: this.userService.getAdminUsers(search, role, 'former').pipe(catchError(() => of([] as AdminUser[])))
      }).pipe(
        map(({ active, former }) => {
          const byId = new Map<number, AdminUser>();
          for (const u of active) {
            byId.set(u.id, u);
          }
          for (const u of former) {
            byId.set(u.id, u);
          }
          return this.sortUsersByName(this.withoutClients([...byId.values()]));
        }),
        catchError((err) => {
          this.error = err?.error?.message || 'Failed to load users.';
          return of([]);
        })
      );
    }

    return this.userService.getAdminUsers(search, role, this.listStatusFilter).pipe(
      map((list) => this.sortUsersByName(this.withoutClients(list))),
      catchError((err) => {
        this.error = err?.error?.message || 'Failed to load users.';
        return of([]);
      })
    );
  }

  private sortUsersByName(users: AdminUser[]): AdminUser[] {
    return [...users].sort((a, b) => {
      const na = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim().toLowerCase();
      const nb = `${b.firstName ?? ''} ${b.lastName ?? ''}`.trim().toLowerCase();
      return na.localeCompare(nb, undefined, { sensitivity: 'base' });
    });
  }

  private withoutClients(users: AdminUser[]): AdminUser[] {
    return users.filter((u) => u.role !== 'CLIENT');
  }
}
