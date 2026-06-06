import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ChipModule } from 'primeng/chip';
import { MultiSelectModule } from 'primeng/multiselect';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { CreateUserRole, UserService } from '../../../../services/user.service';
import { Skill } from '../../../../models/skill.model';
import { SkillService } from '../../../../services/skill.service';

type CreateUserGender = 'FEMALE' | 'MALE' | 'OTHER' | '';

@Component({
  selector: 'app-create-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    MultiSelectModule,
    TextareaModule,
    CardModule,
    ChipModule,
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
  form = {
    firstName: '',
    lastName: '',
    email: '',
    gender: '' as CreateUserGender,
    phoneNumber: '',
    address: '',
  };
  selectedSkillIds: number[] = [];
  allSkills: Skill[] = [];
  skillsLoading = false;
  newSkillName = '';
  addingSkill = false;
  createLoading = false;
  createError: string | null = null;

  /** Avoid NG0100 when async subscriptions set bindable error text after stabilisation. */
  private setDeferredCreateError(message: string | null): void {
    setTimeout(() => {
      this.createError = message;
    }, 0);
  }

  readonly createRoleOptions: { label: string; value: CreateUserRole; icon: string; description: string }[] = [
    {
      label: 'Collaborator',
      value: 'COLLABORATOR',
      icon: 'pi pi-users',
      description: 'Work on tasks and collaborate on projects they are added to.'
    },
    {
      label: 'Project manager',
      value: 'PROJECT_MANAGER',
      icon: 'pi pi-briefcase',
      description:
        'Runs assigned projects (tasks, team, tracking). Can propose new project ideas; archive and lifecycle actions stay with administrators.'
    },
    {
      label: 'Admin',
      value: 'ADMIN',
      icon: 'pi pi-shield',
      description: 'Full administrative access for users, approvals, and project lifecycle. Only for trusted people.'
    }
  ];

  /** Skills UI and payload only for collaborator / project manager — not admin or client. */
  get roleSupportsSkills(): boolean {
    return this.createRole === 'PROJECT_MANAGER' || this.createRole === 'COLLABORATOR';
  }

  get selectedSkillsChips(): Skill[] {
    return this.selectedSkillIds
      .map((id) => this.allSkills.find((s) => s.id === id))
      .filter((s): s is Skill => s != null);
  }

  constructor(
    private userService: UserService,
    private messageService: MessageService,
    private skillService: SkillService
  ) {}

  ngOnInit(): void {
    this.onCreateRoleChange();
  }

  onCreateRoleChange(): void {
    setTimeout(() => {
      this.createError = null;
      if (!this.roleSupportsSkills) {
        this.selectedSkillIds = [];
        return;
      }
      this.loadSkillsIfNeeded();
    }, 0);
  }

  setCreateRole(role: CreateUserRole): void {
    if (this.createRole === role) {
      return;
    }
    this.createRole = role;
    if (!this.roleSupportsSkills) {
      this.selectedSkillIds = [];
    }
    this.onCreateRoleChange();
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
        this.setDeferredCreateError('Could not load skills catalog.');
      }
    });
  }

  removeSelectedSkill(skillId: number): void {
    this.selectedSkillIds = this.selectedSkillIds.filter((id) => id !== skillId);
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
        this.setDeferredCreateError(typeof msg === 'string' ? msg : 'Could not create skill.');
      }
    });
  }

  submit(): void {
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
    const gender = this.form.gender?.trim();
    const phone = this.form.phoneNumber?.trim();
    const address = this.form.address?.trim();

    this.userService
      .createAdminUser({
        firstName: this.form.firstName.trim(),
        lastName: this.form.lastName.trim(),
        email: this.form.email.trim().toLowerCase(),
        role: this.createRole,
        skillIds: this.roleSupportsSkills ? this.selectedSkillIds : [],
        ...(gender ? { gender } : {}),
        ...(phone ? { phoneNumber: phone } : {}),
        ...(address ? { address } : {}),
      })
      .subscribe({
        next: () => {
          this.createLoading = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Account created',
            detail: 'A welcome email with sign-in details was sent.',
            life: 3200
          });
          this.form = {
            firstName: '',
            lastName: '',
            email: '',
            gender: '',
            phoneNumber: '',
            address: '',
          };
          this.selectedSkillIds = [];
        },
        error: (err) => {
          this.createLoading = false;
          const msg = err?.error?.message;
          this.setDeferredCreateError(typeof msg === 'string' ? msg : 'Could not create the account.');
        }
      });
  }
}
