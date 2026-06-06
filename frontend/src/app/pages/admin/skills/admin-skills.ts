import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkillService } from '../../../services/skill.service';
import { Skill } from '../../../models/skill.model';
import { AppLoaderComponent } from '../../../layout/app-loader';

@Component({
  selector: 'app-admin-skills',
  standalone: true,
  templateUrl: './admin-skills.html',
  styleUrls: ['./admin-skills.css'],
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    ToastModule,
    TableModule,
    DialogModule,
    ConfirmDialogModule,
    AppLoaderComponent,
  ],
  providers: [MessageService, ConfirmationService],
})
export class AdminSkillsPage implements OnInit {
  skills: Skill[] | null = null;
  newSkillName = '';
  newDescription: string | null = null;
  saving = false;

  readonly descriptionMaxLength = 1000;

  editOpen = false;
  editForm: { id: number; name: string; description: string | null } = {
    id: 0,
    name: '',
    description: null,
  };
  editSaving = false;

  constructor(
    private readonly skillService: SkillService,
    private readonly messageService: MessageService,
    private readonly confirmation: ConfirmationService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.skills = null;
    this.cdr.markForCheck();
    this.skillService.getAdminSkills().subscribe({
      next: (s) => {
        this.skills = s ?? [];
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.skills = [];
        const detail = this.skillsLoadErrorDetail(err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail,
        });
        this.cdr.markForCheck();
      },
    });
  }

  addSkill(): void {
    const name = this.newSkillName.trim();
    if (!name) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Enter a skill name.' });
      return;
    }
    this.saving = true;
    this.skillService.createSkill(name, this.newDescription).subscribe({
      next: () => {
        this.saving = false;
        this.newSkillName = '';
        this.newDescription = null;
        this.messageService.add({ severity: 'success', summary: 'Created', detail: 'Skill added.' });
        this.reload();
        this.skillService.getAllSkillsRefreshed().subscribe();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message ?? err.error?.error ?? 'Could not create skill.',
        });
        this.cdr.markForCheck();
      },
    });
  }

  openEdit(skill: Skill): void {
    this.editForm = {
      id: skill.id,
      name: skill.name,
      description: skill.description ?? null,
    };
    this.editOpen = true;
  }

  saveEdit(): void {
    const name = this.editForm.name.trim();
    if (!name) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Name is required.' });
      return;
    }
    this.editSaving = true;
    const descNullToClear = this.editForm.description === null || this.editForm.description === '';
    this.skillService
      .updateSkill(this.editForm.id, {
        name,
        description: descNullToClear ? '' : this.editForm.description,
      })
      .subscribe({
        next: () => {
          this.editSaving = false;
          this.editOpen = false;
          this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Skill updated.' });
          this.reload();
          this.skillService.getAllSkillsRefreshed().subscribe();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.editSaving = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message ?? err.error?.error ?? 'Could not update skill.',
          });
          this.cdr.markForCheck();
        },
      });
  }

  confirmArchive(skill: Skill, evt: Event): void {
    this.confirmation.confirm({
      target: evt.target ?? undefined,
      message: `Archive “${skill.name}”? It will disappear from catalogs; existing links remain for history.`,
      header: 'Archive skill',
      icon: 'pi pi-inbox',
      acceptButtonProps: { label: 'Archive', severity: 'danger' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', variant: 'outlined' },
      accept: () => {
        this.skillService.archiveSkill(skill.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'info', summary: 'Archived', detail: 'Skill was archived.' });
            this.reload();
            this.skillService.getAllSkillsRefreshed().subscribe();
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.error?.message ?? err.error?.error ?? 'Could not archive skill.',
            });
            this.cdr.markForCheck();
          },
        });
      },
    });
  }

  descriptionLabel(skill: Skill): string {
    return skill.description?.trim() ? skill.description : '—';
  }

  private skillsLoadErrorDetail(err: { error?: unknown; status?: number }): string {
    const body = err?.error;
    let serverMsg: string | null = null;
    if (typeof body === 'string') {
      serverMsg = body;
    } else if (typeof body === 'object' && body !== null) {
      const record = body as { message?: unknown; error?: unknown };
      if (typeof record.message === 'string') {
        serverMsg = record.message;
      } else if (typeof record.error === 'string') {
        serverMsg = record.error;
      }
    }
    if (serverMsg) {
      return serverMsg;
    }
    if (err?.status === 403) {
      return 'Access denied. Sign in as an administrator.';
    }
    if (err?.status === 0) {
      return 'Cannot reach the server. Is the backend running on port 8080?';
    }
    return 'Could not load skills.';
  }

  usageCount(skill: Skill): number {
    return skill.usageCount ?? 0;
  }
}
