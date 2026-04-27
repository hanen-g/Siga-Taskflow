import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, of } from 'rxjs';
import { catchError, shareReplay, startWith, switchMap } from 'rxjs/operators';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AdminUser, EmployeeRole, EmployeeStatusFilter, UserService } from '../../../services/user.service';
import { FileAccessService } from '../../../services/file-access.service';
import { Skill } from '../../../models/skill.model';
import { SkillService } from '../../../services/skill.service';

type RoleOption = { label: string; value: EmployeeRole };
type StatusOption = { label: string; value: EmployeeStatusFilter };

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
    MultiSelectModule
  ],
  templateUrl: './user-management.html',
  styleUrls: ['./user-management.css']
})
export class UserManagementPage implements OnInit, OnDestroy {
  users$: Observable<AdminUser[] | null> = of(null);
  error: string | null = null;
  private readonly refresh$ = new Subject<void>();
  private readonly profilePictureUrls = new Map<string, string>();
  private readonly profilePicturesLoading = new Set<string>();

  searchTerm = '';
  selectedRole: EmployeeRole = 'ALL';
  selectedStatus: EmployeeStatusFilter = 'active';

  readonly roleOptions: RoleOption[] = [
    { label: 'All Roles', value: 'ALL' },
    { label: 'Project Manager', value: 'PROJECT_MANAGER' },
    { label: 'Collaborator', value: 'COLLABORATOR' },
    { label: 'Client', value: 'CLIENT' }
  ];
  readonly editRoleOptions: { label: string; value: Exclude<EmployeeRole, 'ALL'> | 'ADMIN' }[] = [
    { label: 'Project Manager', value: 'PROJECT_MANAGER' },
    { label: 'Collaborator', value: 'COLLABORATOR' },
    { label: 'Client', value: 'CLIENT' },
    { label: 'Admin', value: 'ADMIN' }
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
    skillIds: [] as number[]
  };
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
  }

  constructor(
    private userService: UserService,
    private fileAccessService: FileAccessService,
    private cdr: ChangeDetectorRef,
    private skillService: SkillService
  ) {}

  ngOnDestroy(): void {
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
          // Defer so avatar [image] does not change during the same change-detection pass (NG0100).
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

  openEditDialog(user: AdminUser): void {
    this.selectedUser = user;
    this.editForm = {
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email ?? '',
      role: user.role,
      skillIds: (user.skills ?? []).map((s) => s.id)
    };
    if (this.roleSupportsSkills(this.editForm.role)) {
      this.loadSkillsIfNeeded();
    }
    this.editDialogVisible = true;
  }

  saveUserEdits(): void {
    if (!this.selectedUser) {
      return;
    }

    this.userService.updateAdminUser(this.selectedUser.id, this.editForm).subscribe({
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
