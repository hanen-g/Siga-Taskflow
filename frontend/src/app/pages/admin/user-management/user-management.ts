import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { catchError, shareReplay, startWith, switchMap, takeUntil } from 'rxjs/operators';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import {
  AdminUser,
  CreateUserRole,
  EmployeeRole,
  EmployeeStatusFilter,
  UserService
} from '../../../services/user.service';
import { Skill } from '../../../models/skill.model';
import { SkillService } from '../../../services/skill.service';
import { UserDirectoryRefreshService } from '../../../services/user-directory-refresh.service';
import { ProfilePictureCacheService } from '../../../services/profile-picture-cache.service';

type RoleOption = { label: string; value: EmployeeRole };
type StatusOption = { label: string; value: EmployeeStatusFilter };
type EmployeeGender = '' | 'FEMALE' | 'MALE' | 'OTHER';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TagModule,
    AvatarModule,
    ButtonModule,
    DialogModule,
    MultiSelectModule,
    TextareaModule
  ],
  templateUrl: './user-management.html',
  styleUrls: ['./user-management.css']
})
export class UserManagementPage implements OnInit, OnDestroy {
  users$: Observable<AdminUser[] | null> = of(null);
  error: string | null = null;
  private readonly refresh$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  searchTerm = '';
  selectedRole: EmployeeRole = 'ALL';
  roleLocked = false;
  selectedStatus: EmployeeStatusFilter = 'active';

  readonly roleOptions: RoleOption[] = [
    { label: 'All Roles', value: 'ALL' },
    { label: 'Project Manager', value: 'PROJECT_MANAGER' },
    { label: 'Collaborator', value: 'COLLABORATOR' },
    { label: 'Admin', value: 'ADMIN' }
  ];
  readonly editRoleOptions: { label: string; value: Exclude<EmployeeRole, 'ALL'> | 'ADMIN' }[] = [
    { label: 'Project Manager', value: 'PROJECT_MANAGER' },
    { label: 'Collaborator', value: 'COLLABORATOR' },
    { label: 'Admin', value: 'ADMIN' },
    { label: 'Client', value: 'CLIENT' }
  ];

  readonly statusOptions: StatusOption[] = [
    { label: 'Active Employees', value: 'active' },
    { label: 'Former Employees', value: 'former' }
  ];

  private readonly accountCreatedFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  editDialogVisible = false;
  statusDialogVisible = false;
  selectedUser: AdminUser | null = null;

  editForm = {
    firstName: '',
    lastName: '',
    email: '',
    role: 'COLLABORATOR' as Exclude<EmployeeRole, 'ALL'> | 'ADMIN',
    skillIds: [] as number[],
    phoneNumber: '',
    address: '',
    dateOfBirth: '',
    gender: '' as EmployeeGender,
    recruitmentDate: ''
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
    this.users$ = this.refresh$.pipe(
      startWith(void 0),
      switchMap(() => {
        this.error = null;
        return this.userService.getAdminUsers(this.searchTerm, this.selectedRole, this.selectedStatus).pipe(
          catchError((err) => {
            this.error = err?.error?.message || 'Failed to load users.';
            return of([]);
          })
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.applyRoleFromQuery(params);
        this.loadUsers();
      });

    this.userDirectoryRefresh.directoryShouldRefresh$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.clearFetchedProfilePictures();
        this.loadUsers();
      });

    this.profilePictureCache.imageReady.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
  }

  private clearFetchedProfilePictures(): void {
    this.profilePictureCache.revokeAll();
  }

  constructor(
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private skillService: SkillService,
    private route: ActivatedRoute,
    private userDirectoryRefresh: UserDirectoryRefreshService,
    private profilePictureCache: ProfilePictureCacheService
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
    this.destroy$.next();
    this.destroy$.complete();
    this.profilePictureCache.revokeAll();
  }

  loadUsers(): void {
    this.refresh$.next();
  }

  onFiltersChange(): void {
    this.loadUsers();
  }

  roleSeverity(role: string): 'info' | 'success' | 'secondary' | 'warn' | 'danger' | 'contrast' {
    switch (role) {
      case 'PROJECT_MANAGER':
        return 'info';
      case 'COLLABORATOR':
        return 'success';
      case 'CLIENT':
        return 'secondary';
      case 'ADMIN':
        return 'warn';
      default:
        return 'contrast';
    }
  }

  roleLabel(role: string): string {
    return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
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
    return this.profilePictureCache.getDisplayUrl(profilePicture);
  }

  /** PrimeNG Avatar renders {@code label} before {@code image}; omit label when a photo URL is ready. */
  getUserAvatarLabel(user: AdminUser): string | undefined {
    return this.getProfilePictureSrc(user.profilePicture) ? undefined : this.getUserInitials(user);
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
      role: user.role,
      skillIds: (user.skills ?? []).map((s) => s.id),
      phoneNumber: user.phoneNumber ?? '',
      address: user.address ?? '',
      dateOfBirth: this.apiDateToInput(user.dateOfBirth),
      gender,
      recruitmentDate: this.apiDateToInput(user.recruitmentDate)
    };
    if (this.roleSupportsSkills(this.editForm.role)) {
      this.loadSkillsIfNeeded();
    }
    this.editDialogVisible = true;
  }

  showsEmployeeProfile(role: string): boolean {
    return role === 'ADMIN' || role === 'PROJECT_MANAGER' || role === 'COLLABORATOR';
  }

  private apiDateToInput(api: string | null | undefined): string {
    if (!api) return '';
    const s = api.includes('T') ? String(api.split('T')[0]) : String(api).slice(0, 10);
    return s.length >= 10 ? s : '';
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
          dateOfBirth: this.editForm.dateOfBirth?.trim() || undefined,
          gender: (this.editForm.gender ?? '').trim(),
          recruitmentDate: this.editForm.recruitmentDate?.trim() || undefined
        }
      : {};

    this.userService.updateAdminUser(this.selectedUser.id, { ...basePayload, ...profilePayload }).subscribe({
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

  /** Display name for status confirmation copy (quotes included when using a proper name). */
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
}
