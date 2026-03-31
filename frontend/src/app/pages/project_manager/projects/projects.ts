import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject, of } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';
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
import { ProjectPanel } from './components/project-panel';

@Component({
  standalone: true,
  selector: 'app-projects-page',
  templateUrl: './projects.html',
  styleUrls: ['./projects.css'],
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MenuModule,
    ProjectPanel,
    TextareaModule,
    ConfirmDialogModule,
    ToastModule
  ],
  providers: [ConfirmationService, MessageService]
})
export class ProjectsPage implements OnInit {

  role: string | null = null;
  pageTitle = 'Projects';

  private refresh$ = new Subject<void>();

  projects$: Observable<any[]> = of([]);

  private projectsList: any[] = [];

  displayDialog = false;
  isEditMode = false;
  selectedProjectId: number | null = null;

  newProject = { name: '', description: '' };

  constructor(
    private projectService: ProjectService,
    private ws: WebsocketService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {
    this.ws.getProjectUpdates().subscribe(() => {
      this.refresh$.next();
    });
  }

  ngOnInit() {
    this.detectRole();
    this.pageTitle = this.isAdmin ? 'All Projects' : 'Project List';

    this.projects$ = this.refresh$.pipe(
      startWith(null),
      switchMap(() => this.loadProjectsByRole())
    );

    this.projects$.subscribe(projects => {
      this.projectsList = projects || [];
    });

    this.refresh$.next();
  }

  private detectRole() {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        this.role = user?.role ?? null;
      } catch {
        this.role = null;
      }
    }

    if (!this.role) {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          this.role = payload.role;
        } catch {
          this.role = null;
        }
      }
    }
  }

  private get isAdmin() {
    return this.role === 'ADMIN';
  }

  private get isProjectManager() {
    return this.role === 'PROJECT_MANAGER';
  }

  private loadProjectsByRole(): Observable<any[]> {
    return this.isAdmin ? this.projectService.getAllProjects() : this.projectService.myProjects();
  }

  showDialog() {
    this.isEditMode = false;
    this.newProject = { name: '', description: '' };
    this.displayDialog = true;
  }

  closeDialog() {
    this.displayDialog = false;
    this.isEditMode = false;
    this.selectedProjectId = null;
  }

  editProject(project: any) {
    this.isEditMode = true;
    this.selectedProjectId = project.id;
    this.newProject = { ...project };
    this.displayDialog = true;
  }

  private notify(severity: string, summary: string, detail: string) {
    this.messageService.add({ severity, summary, detail });
  }

  private validateProjectName(): boolean {

    const name = this.newProject.name?.trim().toLowerCase();

    if (!name) {
      this.notify('error', 'Validation Error', 'Project name cannot be empty');
      return false;
    }

    const exists = this.projectsList.some(project =>
      project.id !== this.selectedProjectId &&
      project.name.trim().toLowerCase() === name
    );

    if (exists) {
      this.notify('error', 'Validation Error', 'A project with this name already exists');
      return false;
    }

    return true;
  }

  private saveProject() {

    if (!this.validateProjectName()) return;

    const request = this.isEditMode
      ? this.projectService.updateProject(this.selectedProjectId!, this.newProject)
      : this.projectService.createProject(this.newProject);

    request.subscribe(() => {

      this.closeDialog();
      this.refresh$.next();

      this.notify(
        'success',
        'Success',
        this.isEditMode
          ? 'Project updated successfully'
          : 'Project created successfully'
      );
    });
  }

  createProject() {
    this.isEditMode = false;
    this.saveProject();
  }

  updateProject() {
    this.isEditMode = true;
    this.saveProject();
  }

  deleteProject(event: { id: number; nativeEvent: Event }) {

    this.confirmationService.confirm({
      target: event.nativeEvent.target as EventTarget,
      message: 'Do you want to delete this project?',
      header: 'Delete Confirmation',
      icon: 'pi pi-info-circle',
      rejectButtonProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true
      },
      acceptButtonProps: {
        label: 'Delete',
        severity: 'danger'
      },
      accept: () => {

        this.projectService.deleteProject(event.id).subscribe(() => {

          this.refresh$.next();

          this.notify(
            'info',
            'Deleted',
            'Project deleted successfully'
          );
        });
      }
    });
  }

  archiveProject(event: { id: number; archived: boolean; nativeEvent: Event }) {

    const action = event.archived ? 'Archive' : 'Unarchive';

    this.confirmationService.confirm({
      target: event.nativeEvent.target as EventTarget,
      message: `Do you want to ${action.toLowerCase()} this project?`,
      header: `${action} Confirmation`,
      icon: 'pi pi-info-circle',
      rejectButtonProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true
      },
      acceptButtonProps: {
        label: action,
        severity: 'warning'
      },
      accept: () => {

        this.projectService.archiveProject(event.id, event.archived)
          .subscribe(() => {

            this.refresh$.next();

            this.notify(
              'info',
              `${action}d`,
              `Project ${action.toLowerCase()}d successfully`
            );
          });
      }
    });
  }

}