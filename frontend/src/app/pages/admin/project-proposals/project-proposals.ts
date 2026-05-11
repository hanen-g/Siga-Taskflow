import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { PopoverModule } from 'primeng/popover';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ProjectService } from '../../../services/project.service';

interface ProposalRow {
  id: number;
  name: string;
  description?: string;
  clientContact?: string;
  proposerId?: number;
  proposerFirstName?: string;
  proposerLastName?: string;
  proposerEmail?: string;
  proposerRole?: string;
  createdAt?: string;
}

interface ProposerOption {
  id: number;
  label: string;
  role?: string;
  initials: string;
}

@Component({
  selector: 'app-project-proposals',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ToastModule,
    ConfirmDialogModule,
    PopoverModule,
    SkeletonModule
  ],
  templateUrl: './project-proposals.html',
  styleUrls: ['./project-proposals.css'],
  providers: [ConfirmationService, MessageService]
})
export class ProjectProposalsPage implements OnInit {
  proposals: ProposalRow[] = [];
  loading = true;
  error: string | null = null;

  /** ISO yyyy-MM-dd strings, bound to native date inputs. */
  dateFrom: string | null = null;
  dateTo: string | null = null;

  selectedProposerIds: number[] = [];

  private readonly proposalDateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  constructor(
    private projectService: ProjectService,
    private router: Router,
    private messageService: MessageService,
    private confirmation: ConfirmationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    this.projectService.listPendingProposals().subscribe({
      next: (list) => {
        this.proposals = list ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load proposals.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  startCreateFromProposal(p: { id: number }): void {
    this.router.navigate(['/dashboard/admin/projects'], {
      queryParams: { approveProposal: p.id }
    });
  }

  discard(p: { id: number; name: string; nativeEvent?: Event }): void {
    this.confirmation.confirm({
      target: p.nativeEvent?.target ?? undefined,
      message: `Delete the proposal "${p.name}"? This permanently removes it from the database.`,
      header: 'Delete proposal',
      icon: 'pi pi-times-circle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.projectService.discardProposal(p.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'info',
              summary: 'Deleted',
              detail: 'Proposal was removed.'
            });
            this.load();
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err?.error?.message || 'Could not delete.'
            });
            this.cdr.markForCheck();
          }
        });
      }
    });
  }

  // --- Filtering -----------------------------------------------------------

  get dateRangeActive(): boolean {
    return Boolean(this.dateFrom || this.dateTo);
  }

  get proposerOptions(): ProposerOption[] {
    const map = new Map<number, ProposerOption>();
    for (const p of this.proposals) {
      if (p.proposerId == null || map.has(p.proposerId)) continue;
      map.set(p.proposerId, {
        id: p.proposerId,
        label: this.proposerName(p),
        role: p.proposerRole,
        initials: this.proposerInitials(p)
      });
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }

  get filteredProposals(): ProposalRow[] {
    const fromMs = this.dateFrom ? new Date(`${this.dateFrom}T00:00:00`).getTime() : null;
    const toMs = this.dateTo ? new Date(`${this.dateTo}T23:59:59.999`).getTime() : null;
    const proposerSet = new Set(this.selectedProposerIds);
    return this.proposals.filter((p) => {
      if (proposerSet.size && (p.proposerId == null || !proposerSet.has(p.proposerId))) {
        return false;
      }
      if (fromMs != null || toMs != null) {
        if (!p.createdAt) return false;
        const ts = new Date(p.createdAt).getTime();
        if (Number.isNaN(ts)) return false;
        if (fromMs != null && ts < fromMs) return false;
        if (toMs != null && ts > toMs) return false;
      }
      return true;
    });
  }

  onDateFromChange(value: string | null): void {
    this.dateFrom = value || null;
  }

  onDateToChange(value: string | null): void {
    this.dateTo = value || null;
  }

  clearDateRange(): void {
    this.dateFrom = null;
    this.dateTo = null;
  }

  isProposerSelected(id: number): boolean {
    return this.selectedProposerIds.includes(id);
  }

  toggleProposer(id: number): void {
    const idx = this.selectedProposerIds.indexOf(id);
    if (idx >= 0) {
      this.selectedProposerIds = [
        ...this.selectedProposerIds.slice(0, idx),
        ...this.selectedProposerIds.slice(idx + 1)
      ];
    } else {
      this.selectedProposerIds = [...this.selectedProposerIds, id];
    }
  }

  clearProposerFilter(): void {
    this.selectedProposerIds = [];
  }

  resetFilters(): void {
    this.clearDateRange();
    this.clearProposerFilter();
  }

  trackById(_index: number, p: ProposalRow): number {
    return p.id;
  }

  // --- Display helpers -----------------------------------------------------

  isProjectManager(p: ProposalRow): boolean {
    return (p.proposerRole || '').toUpperCase() === 'PROJECT_MANAGER';
  }

  proposerName(p: ProposalRow): string {
    const full = [p.proposerFirstName, p.proposerLastName].filter(Boolean).join(' ').trim();
    return full || p.proposerEmail || 'Unknown';
  }

  proposerInitials(p: ProposalRow): string {
    const first = p.proposerFirstName?.charAt(0) ?? '';
    const last = p.proposerLastName?.charAt(0) ?? '';
    const initials = `${first}${last}`.toUpperCase();
    if (initials) return initials;
    return (p.proposerEmail?.charAt(0) ?? '?').toUpperCase();
  }

  formatRole(role?: string): string {
    if (!role) return '';
    return role.replace(/_/g, ' ').toUpperCase();
  }

  formatDate(value?: string): string {
    if (!value) return 'Unknown date';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Unknown date';
    return this.proposalDateFormatter.format(parsed);
  }

  clientSourceLabel(p: ProposalRow): string {
    if (this.isProjectManager(p)) return ', from submitter';
    if (p.proposerRole) return `(${this.formatRole(p.proposerRole)})`;
    return '';
  }
}
