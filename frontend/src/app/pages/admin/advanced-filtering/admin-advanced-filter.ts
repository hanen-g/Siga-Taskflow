import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import type {
  AdminFilterRoleUserOption,
  AdminProjectAdvancedFilter,
  AdminProjectAdvancedFilterResponse,
  AdminProjectAdvancedFilterRow,
  AdminProjectAdvancedFilterStatus
} from '../../../models/reporting.model';
import { ReportingService } from '../../../services/reporting.service';

@Component({
  selector: 'app-admin-advanced-filter',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToastModule,
    ButtonModule,
    CardModule,
    ChipModule,
    InputTextModule,
    PaginatorModule,
    ProgressBarModule,
    SkeletonModule,
    TagModule
  ],
  providers: [MessageService],
  templateUrl: './admin-advanced-filter.html',
  styleUrls: ['./admin-advanced-filter.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminAdvancedFilterPage implements OnInit {
  loading = false;
  optionsLoading = false;
  pageSize = 6;
  pageIndex = 0;
  totalElements = 0;
  rows: AdminProjectAdvancedFilterRow[] = [];
  filter: AdminProjectAdvancedFilter = this.emptyFilter();
  projectNameOptions: string[] = [];
  managerNameOptions: string[] = [];
  userNameOptions: string[] = [];
  skillNameOptions: string[] = [];
  projectManagerUserOptions: AdminFilterRoleUserOption[] = [];
  collaboratorUserOptions: AdminFilterRoleUserOption[] = [];
  clientUserOptions: AdminFilterRoleUserOption[] = [];
  /** When true, show role-specific user dropdowns and send their ids to the API. */
  useRoleUserFilter = false;
  rolePmUserId: number | null = null;
  roleCollaboratorUserId: number | null = null;
  /** When true (default), collaborator filter includes projects where they are assigned on tasks. */
  roleCollaboratorMatchTasks = true;
  roleClientUserId: number | null = null;
  readonly statusOptions: { label: string; value: AdminProjectAdvancedFilterStatus }[] = [
    { label: 'Any', value: '' },
    { label: 'Active (not completed)', value: 'ACTIVE' },
    { label: 'Not started', value: 'NOT_STARTED' },
    { label: 'In progress', value: 'IN_PROGRESS' },
    { label: 'Paused', value: 'PAUSED' },
    { label: 'Archived', value: 'ARCHIVED' },
    { label: 'Completed', value: 'COMPLETED' }
  ];

  constructor(
    private reporting: ReportingService,
    private messages: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadFilterOptions();
    this.applyFilters();
  }

  applyFilters(): void {
    this.pageIndex = 0;
    this.load(0, this.pageSize);
  }

  resetFilters(): void {
    this.filter = this.emptyFilter();
    this.useRoleUserFilter = false;
    this.rolePmUserId = null;
    this.roleCollaboratorUserId = null;
    this.roleCollaboratorMatchTasks = true;
    this.roleClientUserId = null;
    this.pageIndex = 0;
    this.load(0, this.pageSize);
  }

  onRoleUserFilterChange(checked: boolean): void {
    this.useRoleUserFilter = checked;
    if (checked) {
      this.filter = { ...this.filter, userName: '' };
    } else {
      this.rolePmUserId = null;
      this.roleCollaboratorUserId = null;
      this.roleCollaboratorMatchTasks = true;
      this.roleClientUserId = null;
    }
    this.cdr.markForCheck();
  }

  onPaginate(event: PaginatorState): void {
    this.pageIndex = Math.floor((event.first ?? 0) / (event.rows ?? this.pageSize));
    this.pageSize = event.rows ?? this.pageSize;
    this.load(this.pageIndex, this.pageSize);
  }

  completionRate(row: AdminProjectAdvancedFilterRow): number {
    if (!row.totalTasksCount) {
      return 0;
    }
    return Math.round((100 * row.completedTasksCount) / row.totalTasksCount);
  }

  /** Readable label for persisted `ProjectStatus` names in the UI. */
  statusDisplayLabel(code: string): string {
    const map: Record<string, string> = {
      NOT_STARTED: 'Not started',
      IN_PROGRESS: 'In progress',
      PAUSED: 'Paused',
      ARCHIVED: 'Archived',
      COMPLETED: 'Completed'
    };
    return (map[code] ?? code) || 'Unknown';
  }

  statusSeverity(
    label: string
  ): 'success' | 'info' | 'warn' | 'secondary' | 'danger' | 'contrast' {
    switch (label) {
      case 'COMPLETED':
        return 'success';
      case 'PAUSED':
        return 'warn';
      case 'ARCHIVED':
        return 'secondary';
      case 'NOT_STARTED':
        return 'info';
      case 'IN_PROGRESS':
        return 'info';
      default:
        return 'info';
    }
  }

  exportAs(format: 'csv' | 'pdf'): void {
    if (!this.rows.length) {
      return;
    }
    if (format === 'csv') {
      this.downloadCsv();
      return;
    }
    this.openPrintablePdfView();
  }

  trackByName(_index: number, row: AdminProjectAdvancedFilterRow): string {
    return row.projectName;
  }

  projectSuggestions(): string[] {
    return this.matchSuggestions(this.projectNameOptions, this.filter.projectName);
  }

  managerSuggestions(): string[] {
    return this.matchSuggestions(this.managerNameOptions, this.filter.managerName);
  }

  userSuggestions(): string[] {
    return this.matchSuggestions(this.userNameOptions, this.filter.userName);
  }

  skillSuggestions(): string[] {
    return this.matchSuggestions(this.skillNameOptions, this.filter.skillName);
  }

  private emptyFilter(): AdminProjectAdvancedFilter {
    return {
      projectName: '',
      managerName: '',
      userName: '',
      skillName: '',
      statusLabel: '',
      startDateFrom: '',
      startDateTo: '',
      deadlineFrom: '',
      deadlineTo: ''
    };
  }

  private loadFilterOptions(): void {
    this.optionsLoading = true;
    this.reporting
      .adminAdvancedFilterOptions()
      .pipe(finalize(() => (this.optionsLoading = false)))
      .subscribe({
        next: (options) => {
          this.projectNameOptions = options.projectNames ?? [];
          this.managerNameOptions = options.managerNames ?? [];
          this.userNameOptions = options.userNames ?? [];
          this.skillNameOptions = options.skillNames ?? [];
          this.projectManagerUserOptions = options.projectManagerUsers ?? [];
          this.collaboratorUserOptions = options.collaboratorUsers ?? [];
          this.clientUserOptions = options.clientUsers ?? [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.projectNameOptions = [];
          this.managerNameOptions = [];
          this.userNameOptions = [];
          this.skillNameOptions = [];
          this.projectManagerUserOptions = [];
          this.collaboratorUserOptions = [];
          this.clientUserOptions = [];
          this.cdr.markForCheck();
        }
      });
  }

  private matchSuggestions(source: string[], rawQuery: string | undefined, limit = 8): string[] {
    if (!source.length) {
      return [];
    }
    const query = (rawQuery ?? '').trim().toLowerCase();
    if (!query) {
      return source.slice(0, limit);
    }
    return source.filter((value) => value.toLowerCase().includes(query)).slice(0, limit);
  }

  private buildQueryFilter(): AdminProjectAdvancedFilter {
    const base: AdminProjectAdvancedFilter = { ...this.filter };
    if (!this.useRoleUserFilter) {
      return base;
    }
    return {
      ...base,
      ...(this.rolePmUserId != null ? { filterPmUserId: this.rolePmUserId } : {}),
      ...(this.roleCollaboratorUserId != null
        ? {
            filterCollaboratorUserId: this.roleCollaboratorUserId,
            ...(this.roleCollaboratorMatchTasks ? { filterCollaboratorMatchTasks: true } : {})
          }
        : {}),
      ...(this.roleClientUserId != null ? { filterClientUserId: this.roleClientUserId } : {})
    };
  }

  private load(page: number, size: number): void {
    this.loading = true;
    this.reporting
      .adminAdvancedFilter(this.buildQueryFilter(), page, size)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response: AdminProjectAdvancedFilterResponse) => {
          this.rows = response.projects;
          this.totalElements = response.totalElements;
          this.pageIndex = response.page;
          this.pageSize = response.size;
          this.cdr.markForCheck();
        },
        error: () => {
          this.rows = [];
          this.totalElements = 0;
          this.messages.add({
            severity: 'error',
            summary: 'Could not load filtered projects',
            detail: 'Please review your filters and try again.'
          });
          this.cdr.markForCheck();
        }
      });
  }

  private downloadCsv(): void {
    const lines: string[] = [];
    lines.push(
      [
        'Project name',
        'Project manager',
        'Start date',
        'Deadline',
        'Total tasks',
        'Completed tasks',
        'On hold tasks',
        'Overdue tasks',
        'Collaborators',
        'Skills',
        'Status'
      ].join(',')
    );
    this.rows.forEach((row) => {
      lines.push(
        [
          row.projectName,
          row.projectManagerName,
          row.startDateIso,
          row.deadlineIso,
          row.totalTasksCount,
          row.completedTasksCount,
          row.onHoldTasksCount,
          row.overdueTasksCount,
          row.collaboratorNames.join('; '),
          row.skills.join('; '),
          row.projectStatusLabel ? this.statusDisplayLabel(row.projectStatusLabel) : ''
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(',')
      );
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `taskflow-admin-filter-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private openPrintablePdfView(): void {
    const win = window.open('', '_blank');
    if (!win) {
      this.messages.add({
        severity: 'warn',
        summary: 'Popup blocked',
        detail: 'Allow popups to export PDF.'
      });
      return;
    }
    const cards = this.rows
      .map(
        (r) => `
        <div style="border:1px solid #ddd;padding:12px;margin-bottom:10px;border-radius:8px;">
          <h3 style="margin:0 0 8px 0;">${this.escapeHtml(r.projectName)}</h3>
          <p style="margin:2px 0;">Manager: ${this.escapeHtml(r.projectManagerName)}</p>
          <p style="margin:2px 0;">Start: ${r.startDateIso ? this.escapeHtml(r.startDateIso) : '-'}, Deadline: ${r.deadlineIso ? this.escapeHtml(r.deadlineIso) : '-'}</p>
          <p style="margin:2px 0;">Tasks: ${r.completedTasksCount}/${r.totalTasksCount} completed</p>
          <p style="margin:2px 0;">On hold: ${r.onHoldTasksCount}, Overdue: ${r.overdueTasksCount}</p>
          <p style="margin:2px 0;">Status: ${this.escapeHtml(this.statusDisplayLabel(r.projectStatusLabel))}</p>
          <p style="margin:2px 0;">Skills: ${r.skills.length ? this.escapeHtml(r.skills.join(', ')) : '-'}</p>
        </div>`
      )
      .join('');
    win.document.write(`<html><head><title>TaskFlow Advanced filter</title></head><body>${cards}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
