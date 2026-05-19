import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject, of, switchMap, startWith } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { TextareaModule } from 'primeng/textarea';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';

import { ActivatedRoute, Router } from '@angular/router';
import { Project } from '../../../models/project.model';
import { ProjectService } from '../../../services/project.service';
import { WebsocketService } from '../../../services/websocket.service';
import { ProjectMessage } from '../../../models/project-message.model';
import { ApiService } from '../../../services/api';
import { ProjectPanel } from '../project-panel';
import { AppLoaderComponent } from '../../../layout/app-loader';

@Component({
  standalone: true,
  selector: 'app-archived-projects-page',
  templateUrl: './archived-projects.html',
  styleUrls: ['./archived-projects.css'],
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MenuModule,
    ProjectPanel,
    AppLoaderComponent,
    TextareaModule,
    ConfirmDialogModule,
    ToastModule
  ],
  providers: [ConfirmationService, MessageService]
})
export class ArchivedProjectsPage implements OnInit {
  role: string | null = null;
  viewMode: 'archived' | 'delivered' = 'archived';
  /** Project detail link: admin vs project manager area */
  detailBase = '/dashboard/pm/projects';

  private refresh$ = new Subject<void>();

  archivedProjects$: Observable<any[] | null> = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() => {
      this.error = null;
      const request$ =
        this.viewMode === 'delivered'
          ? this.projectService.getProjectsByStatus('COMPLETED')
          : this.projectService.getProjectsByStatus('ARCHIVED');

      return request$.pipe(
        catchError(() => {
          this.error =
            this.viewMode === 'delivered'
              ? 'Unable to load delivered projects.'
              : 'Unable to load archived projects.';
          return of([]);
        })
      );
    })
  );
  error: string | null = null;

  get isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  constructor(
    private projectService: ProjectService,
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private ws: WebsocketService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {
    this.ws.getProjectUpdates().subscribe((msg: ProjectMessage) => {
      this.refresh$.next();
    });
  }

  ngOnInit(): void {
    this.viewMode = this.route.snapshot.data['mode'] === 'delivered' ? 'delivered' : 'archived';

    this.role = this.api.getResolvedRole();
    this.detailBase = this.isAdmin ? '/dashboard/admin/projects' : '/dashboard/pm/projects';
  }

  goToProject(project: Project): void {
    if (project?.id) {
      void this.router.navigate([this.detailBase, project.id]);
    }
  }

  private projectConfirmPhrase(name: string | undefined | null): string {
    const n = typeof name === 'string' ? name.trim() : '';
    return n ? `the project “${n}”` : 'this project';
  }

  pauseProject(event: { id: number; paused: boolean; name?: string; nativeEvent: Event }): void {
    const action = event.paused ? 'pause' : 'resume';
    const phrase = this.projectConfirmPhrase(event.name);
    this.confirmationService.confirm({
      target: event.nativeEvent.target as EventTarget,
      message: event.paused
        ? `Are you sure you want to pause ${phrase}?`
        : `Are you sure you want to resume ${phrase} and clear the paused state?`,
      header: event.paused ? 'Pause project' : 'Resume project',
      icon: 'pi pi-info-circle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: event.paused ? 'Pause' : 'Resume', severity: 'warning' },
      accept: () => {
        this.projectService.setProjectLifecycle(event.id, { status: event.paused ? 'PAUSED' : 'IN_PROGRESS' }).subscribe({
          next: () => {
            this.refresh$.next();
            this.messageService.add({ severity: 'success', summary: 'Updated', detail: `Project ${action}d successfully.` });
          },
          error: (err) => {
            const m = err?.error?.message ?? err?.error?.error;
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: typeof m === 'string' ? m : 'Could not update the project.'
            });
          }
        });
      }
    });
  }

  deliverProject(event: { id: number; delivered: boolean; name?: string; nativeEvent: Event }): void {
    const phrase = this.projectConfirmPhrase(event.name);
    this.confirmationService.confirm({
      target: event.nativeEvent.target as EventTarget,
      message: event.delivered
        ? `Are you sure you want to deliver ${phrase} (mark it as closed)?`
        : `Are you sure you want to reopen ${phrase} and clear the delivered state?`,
      header: event.delivered ? 'Mark as delivered' : 'Reopen project',
      icon: 'pi pi-info-circle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: event.delivered ? 'Mark delivered' : 'Reopen', severity: 'success' },
      accept: () => {
        this.projectService.setProjectLifecycle(event.id, { status: event.delivered ? 'COMPLETED' : 'IN_PROGRESS' }).subscribe({
          next: () => {
            this.refresh$.next();
            this.messageService.add({ severity: 'success', summary: 'Updated', detail: 'Project status was updated.' });
          },
          error: (err) => {
            const m = err?.error?.message ?? err?.error?.error;
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: typeof m === 'string' ? m : 'Could not update the project.'
            });
          }
        });
      }
    });
  }

  unarchiveProject(event: { id: number; archived: boolean; name?: string; nativeEvent: Event }): void {
    const action = event.archived ? 'Archive' : 'Unarchive';
    const phrase = this.projectConfirmPhrase(event.name);

    this.confirmationService.confirm({
      target: event.nativeEvent.target as EventTarget,
      message: `Are you sure you want to ${action.toLowerCase()} ${phrase}?`,
      header: `${action} Confirmation`,
      icon: 'pi pi-info-circle',
      rejectLabel: 'Cancel',
      rejectButtonProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true
      },
      acceptButtonProps: {
        label: action,
        severity: 'success'
      },
      accept: () => {
        this.projectService.archiveProject(event.id, event.archived).subscribe({
          next: () => {
            this.refresh$.next();
            this.messageService.add({
              severity: 'info',
              summary: `${action}d`,
              detail: `Project ${action.toLowerCase()}d successfully`
            });
          },
          error: (err) => {
            const m = err?.error?.message ?? err?.error?.error;
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: typeof m === 'string' ? m : `Could not ${action.toLowerCase()} this project.`
            });
          }
        });
      }
    });
  }
}
