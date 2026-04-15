import { Component } from '@angular/core';
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

import { ProjectService } from '../../../services/project.service';
import { WebsocketService } from '../../../services/websocket.service';
import { ProjectMessage } from '../../../models/project-message.model';
import { ProjectPanel } from '../projects/project-panel';
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
export class ArchivedProjectsPage {

  private refresh$ = new Subject<void>();

  archivedProjects$: Observable<any[] | null> = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() => {
      this.error = null;
      return this.projectService.getArchivedProjects().pipe(
        catchError(() => {
          this.error = 'Unable to load archived projects.';
          return of([]);
        })
      );
    })
  );
  error: string | null = null;

  constructor(
    private projectService: ProjectService,
    private ws: WebsocketService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {
    this.ws.getProjectUpdates().subscribe((msg: ProjectMessage) => {
      this.refresh$.next();
    });
  }

  unarchiveProject(event: { id: number; archived: boolean; nativeEvent: Event }) {
    // event.archived is the desired archived value. For unarchive, it will be false.
    const action = event.archived ? 'Archive' : 'Unarchive';

    this.confirmationService.confirm({
      target: event.nativeEvent.target as EventTarget,
      message: `Do you want to ${action.toLowerCase()} this project?`,
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
        this.projectService.archiveProject(event.id, event.archived).subscribe(() => {
          this.refresh$.next();
          this.messageService.add({
            severity: 'info',
            summary: `${action}d`,
            detail: `Project ${action.toLowerCase()}d successfully`
          });
        });
      },
    });
  }
}
