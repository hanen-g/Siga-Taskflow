import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { CreateUserRole, UserService } from '../../../services/user.service';
import { Skill } from '../../../models/skill.model';
import { SkillService } from '../../../services/skill.service';

@Component({
  selector: 'app-create-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
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
export class CreateUsersPage {
  createRole: CreateUserRole | null = null;
  supportsSkills = false;
  form = { firstName: '', lastName: '', email: '' };
  selectedSkillIds: number[] = [];
  allSkills: Skill[] = [];
  skillsLoading = false;
  newSkillName = '';
  addingSkill = false;
  createLoading = false;
  createInfoMessage: string | null = null;
  createError: string | null = null;

  readonly createRoleOptions: { label: string; value: CreateUserRole }[] = [
    { label: 'Project manager', value: 'PROJECT_MANAGER' },
    { label: 'Collaborator', value: 'COLLABORATOR' },
    { label: 'Client', value: 'CLIENT' },
    { label: 'Admin', value: 'ADMIN' }
  ];

  constructor(
    private userService: UserService,
    private messageService: MessageService,
    private skillService: SkillService
  ) {}

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
        return 'This user can create and manage projects, assign tasks, and track delivery.';
      case 'COLLABORATOR':
        return 'This user can work on tasks and collaborate on projects they are added to.';
      case 'CLIENT':
        return 'This user has a read-focused client view of shared work.';
      case 'ADMIN':
        return 'Full administrative access, including user management. Only for trusted people.';
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
      this.loadSkillsIfNeeded();
    }, 0);
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
        this.createError = 'Could not load skills catalog.';
      }
    });
  }

  addSkillToCatalog(): void {
    const name = this.newSkillName.trim();
    if (!name) {
      this.createError = 'Enter a skill name first.';
      return;
    }
    this.createError = null;
    this.addingSkill = true;
    this.skillService.createSkill(name).subscribe({
      next: (created) => {
        this.addingSkill = false;
        this.newSkillName = '';
        this.allSkills = [...this.allSkills, created].sort((a, b) => a.name.localeCompare(b.name));
        if (!this.selectedSkillIds.includes(created.id)) {
          this.selectedSkillIds = [...this.selectedSkillIds, created.id];
        }
        this.messageService.add({
          severity: 'success',
          summary: 'Skill added',
          detail: `"${created.name}" was created and selected.`
        });
      },
      error: (err) => {
        this.addingSkill = false;
        const msg = err?.error?.message ?? err?.error?.error;
        this.createError = typeof msg === 'string' ? msg : 'Could not create skill.';
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
    this.userService
      .createAdminUser({
        firstName: this.form.firstName.trim(),
        lastName: this.form.lastName.trim(),
        email: this.form.email.trim().toLowerCase(),
        role: this.createRole,
        skillIds: this.supportsSkills ? this.selectedSkillIds : []
      })
      .subscribe({
        next: (res) => {
          this.createLoading = false;
          const parts = [res.message];
          if (res.user?.createdAt) {
            const when = new Date(res.user.createdAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short'
            });
          }
          const detail = parts.join(' ');
          this.createInfoMessage = null;
          this.messageService.add({
            severity: 'success',
            summary: 'Account created',
            detail,
            life: 1000
          });
          this.form = { firstName: '', lastName: '', email: '' };
          this.selectedSkillIds = [];
        },
        error: (err) => {
          this.createLoading = false;
          const msg = err?.error?.message;
          this.createError = typeof msg === 'string' ? msg : 'Could not create the account.';
        }
      });
  }
}
