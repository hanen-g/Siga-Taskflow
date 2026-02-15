import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject, switchMap, startWith } from 'rxjs';
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
export class ProjectsPage {

  private refresh$ = new Subject<void>();

  projects$: Observable<any[]> = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() => this.projectService.myProjects())
  );

  displayDialog = false;
  newProject = { name: '', description: '' };

  isEditMode = false;
  selectedProjectId: number | null = null;

  // Store projects list for validation
  private projectsList: any[] = [];

  constructor(
    private projectService: ProjectService,
    private cdr: ChangeDetectorRef,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {
    // Subscribe to projects to keep local copy for validation
    this.projects$.subscribe(projects => {
      this.projectsList = projects || [];
    });
  }

  showDialog() {
    this.isEditMode = false;
    this.newProject = { name: '', description: '' };
    this.displayDialog = true;
    this.cdr.markForCheck();
  }

  closeDialog() {
    this.displayDialog = false;
    this.isEditMode = false;
  }

  // Validation method
  validateProjectName(): boolean {
    // Check if name is empty
    if (!this.newProject.name || this.newProject.name.trim() === '') {
      this.messageService.add({ 
        severity: 'error', 
        summary: 'Validation Error', 
        detail: 'Project name cannot be empty' 
      });
      return false;
    }

    // Check if name already exists (case insensitive)
    const nameLower = this.newProject.name.trim().toLowerCase();
    const nameExists = this.projectsList.some(project => {
      // If editing, exclude current project from check
      if (this.isEditMode && project.id === this.selectedProjectId) {
        return false;
      }
      return project.name.trim().toLowerCase() === nameLower;
    });

    if (nameExists) {
      this.messageService.add({ 
        severity: 'error', 
        summary: 'Validation Error', 
        detail: 'A project with this name already exists' 
      });
      return false;
    }

    return true;
  }

  createProject() {
    // Validate before creating
    if (!this.validateProjectName()) {
      return;
    }

    this.projectService.createProject(this.newProject).subscribe(() => {
      this.closeDialog();
      this.refresh$.next();
      this.messageService.add({ 
        severity: 'success', 
        summary: 'Success', 
        detail: 'Project created successfully' 
      });
    });
  }

  updateProject() {
    // Validate before updating
    if (!this.validateProjectName()) {
      return;
    }

    this.projectService.updateProject(this.selectedProjectId!, this.newProject)
      .subscribe(() => {
        this.closeDialog();
        this.refresh$.next();
        this.messageService.add({ 
          severity: 'success', 
          summary: 'Success', 
          detail: 'Project updated successfully' 
        });
      });
  }

  editProject(project: any) {
    this.isEditMode = true;
    this.selectedProjectId = project.id;
    this.newProject = { ...project };
    this.displayDialog = true;
    this.cdr.markForCheck();
  }

  deleteProject(event: { id: number, nativeEvent: Event }) {
    this.confirmationService.confirm({
      target: event.nativeEvent.target as EventTarget,
      message: 'Do you want to delete this project?',
      header: 'Delete Confirmation',
      icon: 'pi pi-info-circle',
      rejectLabel: 'Cancel',
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
          this.messageService.add({ 
            severity: 'info', 
            summary: 'Deleted', 
            detail: 'Project deleted successfully' 
          });
        });
      },
      reject: () => {
        this.messageService.add({ 
          severity: 'warn', 
          summary: 'Cancelled', 
          detail: 'Delete action cancelled' 
        });
      }
    });
  }
}