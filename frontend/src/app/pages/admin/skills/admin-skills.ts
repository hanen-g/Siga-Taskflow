import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkillService } from '../../../services/skill.service';
import { Skill } from '../../../models/skill.model';
import { AppLoaderComponent } from '../../../layout/app-loader';

type CategoryOpt = { label: string; value: string };

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
    ToastModule,
    TableModule,
    SelectModule,
    DialogModule,
    ConfirmDialogModule,
    AppLoaderComponent,
  ],
  providers: [MessageService, ConfirmationService],
})
export class AdminSkillsPage implements OnInit {
  skills: Skill[] | null = null;
  newSkillName = '';
  newCategory: string | null = null;
  saving = false;

  readonly categoryPresetOptions: CategoryOpt[] = [
    { label: 'Programming', value: 'Programming' },
    { label: 'Design', value: 'Design' },
    { label: 'Management', value: 'Management' },
    { label: 'Language', value: 'Language' },
  ];

  editOpen = false;
  editForm: { id: number; name: string; category: string | null } = {
    id: 0,
    name: '',
    category: null,
  };
  editSaving = false;

  constructor(
    private skillService: SkillService,
    private messageService: MessageService,
    private confirmation: ConfirmationService,
    private cdr: ChangeDetectorRef,
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
        const body = err?.error;
        const serverMsg =
          typeof body === 'string'
            ? body
            : typeof body?.message === 'string'
              ? body.message
              : typeof body?.error === 'string'
                ? body.error
                : null;
        const detail =
          serverMsg ??
          (err?.status === 403
            ? 'Access denied. Sign in as an administrator.'
            : err?.status === 0
              ? 'Cannot reach the server. Is the backend running on port 8080?'
              : 'Could not load skills.');
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
    this.skillService.createSkill(name, this.newCategory).subscribe({
      next: () => {
        this.saving = false;
        this.newSkillName = '';
        this.newCategory = null;
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
      category: skill.category ?? null,
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
    const catNullToClear = this.editForm.category === null || this.editForm.category === '';
    this.skillService
      .updateSkill(this.editForm.id, {
        name,
        category: catNullToClear ? '' : this.editForm.category,
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

  categoryLabel(skill: Skill): string {
    return skill.category?.trim() ? skill.category : '—';
  }

  usageCount(skill: Skill): number {
    return skill.usageCount ?? 0;
  }

  /** Preserve categories not present in presets (legacy / custom rows). */
  editCategoryDropdownOptions(): CategoryOpt[] {
    const opts = [...this.categoryPresetOptions];
    const c = this.editForm.category?.trim();
    if (c && !opts.some((o) => o.value === c)) {
      return [{ label: c, value: c }, ...opts];
    }
    return opts;
  }
}
