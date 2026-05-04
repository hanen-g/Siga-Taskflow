import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { CreateUserRole, UserService } from '../../../services/user.service';
import { Skill } from '../../../models/skill.model';
import { SkillService } from '../../../services/skill.service';

type EmployeeGender = '' | 'FEMALE' | 'MALE' | 'OTHER';

@Component({
  selector: 'app-create-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    MultiSelectModule,
    CardModule,
    ButtonModule,
    MessageModule,
    ToastModule
  ],
  templateUrl: './create-users.html',
  styleUrls: ['./create-users.css'],
  providers: [MessageService]
})
export class CreateUsersPage implements OnInit {
  createRole: CreateUserRole | null = 'COLLABORATOR';
  supportsSkills = true;
  form = {
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: '',
    gender: '' as EmployeeGender,
    recruitmentDate: '',
    address: ''
  };
  selectedSkillIds: number[] = [];
  allSkills: Skill[] = [];
  /** When false, p-multiselect is not mounted — avoids NG0100 ([] → data) with shareReplay + dev CD. */
  skillsCatalogReady = false;
  skillsLoading = false;
  newSkillName = '';
  addingSkill = false;
  createLoading = false;
  createInfoMessage: string | null = null;
  createError: string | null = null;

  /**
   * Sets inline form error outside the dev-mode verification pass that follows HttpClient emits.
   * Also used for deferred clears from loadSkills failures.
   */
  private setDeferredCreateError(message: string | null): void {
    this.deferSkillsViewUpdate(() => {
      this.createError = message;
    });
  }

  /** Next macrotask — avoids NG0100 for skills/options and similar. */
  private deferSkillsViewUpdate(cb: () => void): void {
    setTimeout(() => cb(), 0);
  }

  /** Double defer: HttpClient error + synchronous createLoading mutation still trips NG0100 on createError in v21. */
  private deferSubmitOutcome(cb: () => void): void {
    setTimeout(() => setTimeout(() => cb(), 0), 0);
  }

  readonly createRoleOptions: { label: string; value: CreateUserRole }[] = [
    { label: 'Collaborator', value: 'COLLABORATOR' },
    { label: 'Project Manager', value: 'PROJECT_MANAGER' },
    { label: 'Admin', value: 'ADMIN' }
  ];

  readonly genderOptions: { label: string; value: EmployeeGender }[] = [
    { label: '—', value: '' },
    { label: 'Female', value: 'FEMALE' },
    { label: 'Male', value: 'MALE' },
    { label: 'Other', value: 'OTHER' }
  ];

  private emptyForm() {
    return {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      dateOfBirth: '',
      gender: '' as EmployeeGender,
      recruitmentDate: '',
      address: ''
    };
  }

  constructor(
    private userService: UserService,
    private messageService: MessageService,
    private skillService: SkillService
  ) {}

  ngOnInit(): void {
    this.onCreateRoleChange();
  }

  getCreateRoleTitle(): string {
    if (!this.createRole) {
      return '';
    }
    return this.createRoleOptions.find((o) => o.value === this.createRole)?.label ?? 'New account';
  }

  getCreateRoleBlurb(): string {
    if (!this.createRole) {
      return '';
    }
    switch (this.createRole) {
      case 'PROJECT_MANAGER':
        return 'Runs assigned projects (tasks, team, tracking). Can propose new project ideas. Project archive, pause, mark-as-delivered, and deletion are reserved for an administrator.';
      case 'COLLABORATOR':
        return 'This user can work on tasks and collaborate on projects they are added to.';
      case 'CLIENT':
        return 'This user has a read-focused client view of shared work.';
      case 'ADMIN':
        return 'Full administrative access: users, approvals of proposed projects, and project lifecycle (archive, pause, delivered, delete). Only for trusted people.';
      default:
        return '';
    }
  }

  onCreateRoleChange(): void {
    setTimeout(() => {
      this.supportsSkills = this.createRole === 'PROJECT_MANAGER' || this.createRole === 'COLLABORATOR';
      this.createError = null;
      if (!this.supportsSkills) {
        this.selectedSkillIds = [];
        return;
      }
      if (this.allSkills.length > 0) {
        this.skillsCatalogReady = true;
      }
      this.loadSkillsIfNeeded();
    }, 0);
  }

  setCreateRole(role: CreateUserRole): void {
    if (this.createRole === role) {
      return;
    }
    this.createRole = role;
    this.onCreateRoleChange();
  }

  private loadSkillsIfNeeded(): void {
    if (this.allSkills.length > 0) {
      this.skillsCatalogReady = true;
      return;
    }
    if (this.skillsLoading) {
      return;
    }
    this.skillsLoading = true;
    this.skillService.getAllSkills().subscribe({
      next: (skills) => {
        this.deferSkillsViewUpdate(() => {
          this.allSkills = skills ?? [];
          this.skillsLoading = false;
          this.skillsCatalogReady = true;
        });
      },
      error: () => {
        this.deferSkillsViewUpdate(() => {
          this.allSkills = [];
          this.skillsLoading = false;
          this.skillsCatalogReady = true;
          this.setDeferredCreateError('Could not load skills catalog.');
        });
      }
    });
  }

  /**
   * Saves a new skill to the catalog via API immediately — does not create a user account.
   * Repeat as needed; submit() creates the account only when you click Create account.
   */
  addSkillToCatalog(): void {
    const name = this.newSkillName.trim();
    if (!name) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Skill name required',
        detail: 'Enter a skill name, then click Add to catalog.'
      });
      return;
    }
    this.addingSkill = true;
    this.skillService.createSkill(name).subscribe({
      next: (created) => {
        this.addingSkill = false;
        this.newSkillName = '';
        this.deferSkillsViewUpdate(() => {
          const merged = [...this.allSkills.filter((s) => s.id !== created.id), created];
          this.allSkills = merged.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
          if (!this.selectedSkillIds.includes(created.id)) {
            this.selectedSkillIds = [...this.selectedSkillIds, created.id];
          }
        });
        this.messageService.add({
          severity: 'success',
          summary: 'Saved to catalog',
          detail: `"${created.name}" is in the catalog. Add more skills or finish the form — the account is only created with Create account.`
        });
      },
      error: (err) => {
        this.addingSkill = false;
        const body = err?.error;
        const msg =
          typeof body === 'string'
            ? body
            : typeof body?.message === 'string'
              ? body.message
              : typeof body?.error === 'string'
                ? body.error
                : null;
        const detail = msg ?? 'Could not save the skill to the catalog.';
        const conflict = err?.status === 409;
        this.messageService.add({
          severity: conflict ? 'warn' : 'error',
          summary: conflict ? 'Skill already in catalog' : 'Catalog update failed',
          detail
        });
      }
    });
  }

  submit(): void {
    this.createInfoMessage = null;
    this.createError = null;

    if (!this.createRole) {
      this.createError = 'Select a role first.';
      return;
    }
    if (!this.form.firstName?.trim() || !this.form.lastName?.trim() || !this.form.email?.trim()) {
      this.createError = 'Please fill in first name, last name, and email.';
      return;
    }

    this.createLoading = true;
    const dob = this.form.dateOfBirth?.trim();
    const recruited = this.form.recruitmentDate?.trim();
    this.userService
      .createAdminUser({
        firstName: this.form.firstName.trim(),
        lastName: this.form.lastName.trim(),
        email: this.form.email.trim().toLowerCase(),
        role: this.createRole,
        skillIds: this.supportsSkills ? this.selectedSkillIds : [],
        phoneNumber: this.form.phoneNumber?.trim() || undefined,
        address: this.form.address?.trim() || undefined,
        dateOfBirth: dob || undefined,
        gender: this.form.gender || undefined,
        recruitmentDate: recruited || undefined
      })
      .subscribe({
        next: (res) => {
          const parts = [res.message];
          if (res.user?.createdAt) {
            new Date(res.user.createdAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short'
            });
          }
          const detail = parts.join(' ');
          this.messageService.add({
            severity: 'success',
            summary: 'Account created',
            detail,
            life: 6000
          });
          this.deferSubmitOutcome(() => {
            this.createLoading = false;
            this.createInfoMessage = null;
            this.form = this.emptyForm();
            this.selectedSkillIds = [];
          });
        },
        error: (err) => {
          const body = err?.error;
          const msg =
            typeof body === 'string'
              ? body
              : typeof body?.message === 'string'
                ? body.message
                : typeof body?.error === 'string'
                  ? body.error
                  : null;
          this.deferSubmitOutcome(() => {
            this.createLoading = false;
            this.createError = msg ?? 'Could not create the account.';
          });
        }
      });
  }
}
