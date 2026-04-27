import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ProjectService } from '../../../services/project.service';
import { UserService, ProjectManagerOption } from '../../../services/user.service';

@Component({
  selector: 'app-project-proposals',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    TagModule,
    SelectModule,
    ToastModule,
    ConfirmDialogModule
  ],
  templateUrl: './project-proposals.html',
  styleUrls: ['./project-proposals.css'],
  providers: [ConfirmationService, MessageService]
})
export class ProjectProposalsPage implements OnInit {
  proposals: any[] = [];
  projectManagers: ProjectManagerOption[] = [];
  pmSelectOptions: { label: string; value: number }[] = [];
  /** For collaborator-originated proposals, admin must pick a PM per row. */
  managerIdByProposal: Record<number, number | null> = {};
  loading = true;
  error: string | null = null;

  constructor(
    private projectService: ProjectService,
    private userService: UserService,
    private messageService: MessageService,
    private confirmation: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.userService.getProjectManagersForAdmin().subscribe({
      next: (m) => {
        setTimeout(() => {
          this.projectManagers = m;
          this.pmSelectOptions = this.projectManagers.map((u) => ({
            label: `${u.firstName} ${u.lastName} (${u.email})`,
            value: u.id
          }));
          this.load();
        }, 0);
      },
      error: () => {
        setTimeout(() => {
          this.error = 'Could not load project managers.';
          this.load();
        }, 0);
      }
    });
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.projectService.listPendingProposals().subscribe({
      next: (list) => {
        setTimeout(() => {
          const nextManagerIdByProposal: Record<number, number | null> = { ...this.managerIdByProposal };
          for (const p of list) {
            if (p.proposerRole === 'COLLABORATOR' && nextManagerIdByProposal[p.id] === undefined) {
              nextManagerIdByProposal[p.id] = this.projectManagers[0]?.id ?? null;
            }
          }
          this.managerIdByProposal = nextManagerIdByProposal;
          this.proposals = list;
          this.loading = false;
        }, 0);
      },
      error: (err) => {
        setTimeout(() => {
          this.error = err?.error?.message || 'Failed to load proposals.';
          this.loading = false;
        }, 0);
      }
    });
  }

  needsManagerPick(p: { proposerRole: string }): boolean {
    return p.proposerRole === 'COLLABORATOR';
  }

  approve(p: { id: number; proposerRole: string; name: string }): void {
    let managerId: number | null | undefined;
    if (p.proposerRole === 'COLLABORATOR') {
      managerId = this.managerIdByProposal[p.id] ?? null;
      if (managerId == null) {
        this.messageService.add({
          severity: 'error',
          summary: 'Manager required',
          detail: 'Select a project manager before approving a collaborator’s proposal.'
        });
        return;
      }
    }

    this.projectService.approveProposal(p.id, managerId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Approved',
          detail: `Project "${p.name}" was created.`
        });
        this.load();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err?.error?.message || 'Could not approve.'
        });
      }
    });
  }

  discard(p: { id: number; name: string; nativeEvent?: Event }): void {
    this.confirmation.confirm({
      target: p.nativeEvent?.target ?? undefined,
      message: `Discard the proposal “${p.name}”?`,
      header: 'Discard proposal',
      icon: 'pi pi-times-circle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.projectService.discardProposal(p.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'info', summary: 'Discarded', detail: 'Proposal was discarded.' });
            this.load();
          },
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err?.error?.message || 'Could not discard.'
            });
          }
        });
      }
    });
  }

  proposerLabel(p: { proposerFirstName?: string; proposerLastName?: string; proposerEmail?: string; proposerRole?: string }): string {
    const n = [p.proposerFirstName, p.proposerLastName].filter(Boolean).join(' ').trim();
    return `${n || p.proposerEmail} (${(p.proposerRole || '').replace(/_/g, ' ')})`;
  }
}
