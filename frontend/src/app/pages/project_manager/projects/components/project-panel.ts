import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule, Menu } from 'primeng/menu';
import { TextareaModule } from 'primeng/textarea';

import { ProjectService } from '../../../../services/project.service';
import { TaskService } from '../../../../services/task.service';
import { Project } from '../../../../models/project.model';
import { Task, TaskStatus, Priority } from '../../../../models/task.model';

@Component({
  selector: 'app-project-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="project-card">
      <div class="project-banner" [style.background]="bannerColor">
        <p-menu #menu [popup]="true" [appendTo]="'body'" [model]="menuItems" (onShow)="onMenuShow()"></p-menu>
        <button
          pButton
          type="button"
          icon="pi pi-ellipsis-v"
          class="project-menu-button"
          (click)="toggleMenu($event)">
        </button>
      </div>

      <div class="project-card-body">
        <div class="project-copy">
          <h2 class="project-title">{{ project.name }}</h2>
          <p class="project-description">
            {{ project.description || 'No description yet for this project.' }}
          </p>
          <p *ngIf="project.createdAt" class="project-created-at">
            Created {{ project.createdAt | date: 'mediumDate' }}
          </p>
        </div>

        <button
          *ngIf="!project.archived"
          pButton
          type="button"
          label="+ New Task"
          class="project-task-button"
          (click)="openDialog()">
        </button>
      </div>
    </article>

    <input #fileInput type="file" style="display:none" (change)="onFileSelected($event)" />

    <p-dialog
      header="New Task"
      [visible]="taskDialogVisible"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '400px' }"
      (onHide)="taskDialogVisible = false">

      <div class="flex flex-column gap-3">
        <input pInputText
               [(ngModel)]="newTask.title"
               placeholder="Task name">

        <textarea pInputTextarea
                  [(ngModel)]="newTask.description"
                  rows="4"
                  placeholder="Description">
        </textarea>

        <select [(ngModel)]="newTask.priority" class="p-inputtext">
          <option [ngValue]="null">No priority</option>
          <option *ngFor="let p of priorities" [ngValue]="p">{{ priorityLabel(p) }}</option>
        </select>

        <input type="datetime-local"
               pInputText
               [(ngModel)]="newTask.deadline"
               placeholder="Deadline">

        <input pInputText
               [(ngModel)]="newTask.collaboratorEmail"
               placeholder="Email">

        <button pButton
                [label]="isSavingTask ? 'Creating...' : 'Create Task'"
                class="p-button-success"
                [disabled]="isSavingTask"
                (click)="saveTask()">
        </button>
      </div>
    </p-dialog>
  `,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
      MenuModule,
    TextareaModule
  ],
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .project-card {
      display: flex;
      flex-direction: column;
      min-height: 20rem;
      height: 100%;
      overflow: hidden;
      border-radius: 1.5rem;
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
    }

    .project-banner {
      position: relative;
      min-height: 6.75rem;
      height: 33%;
      padding: 1rem;
    }

    .project-menu-button {
      position: absolute;
      top: 0.9rem;
      right: 0.9rem;
      width: 2.5rem;
      height: 2.5rem;
      border: 0;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.58) !important;
      color: #334155 !important;
      backdrop-filter: blur(10px);
    }

    .project-menu-button:enabled:hover {
      background: rgba(255, 255, 255, 0.78) !important;
    }

    .project-card-body {
      display: flex;
      flex: 1;
      flex-direction: column;
      justify-content: space-between;
      gap: 1.5rem;
      padding: 1.4rem;
    }

    .project-copy {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .project-title {
      margin: 0;
      color: #0f172a;
      font-size: 1.2rem;
      font-weight: 500;
      line-height: 1.3;
    }

    .project-description {
      margin: 0;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .project-created-at {
      margin: 0;
      color: #94a3b8;
      font-size: 0.8rem;
      line-height: 1.4;
    }

    .project-task-button {
      width: 100%;
      justify-content: center;
      border: 0;
      border-radius: 0.95rem;
      background: #22c55e !important;
      color: #ffffff !important;
      font-weight: 600;
      box-shadow: none;
    }

    .project-task-button:enabled:hover {
      background: #16a34a !important;
    }
  `]
})
export class ProjectPanel implements OnInit {

  @Input() project!: Project;
  @Output() edit = new EventEmitter<Project>();
  @Output() delete = new EventEmitter<{ id: number; nativeEvent: Event }>();
  @Output() archive = new EventEmitter<{ id: number; archived: boolean; nativeEvent: Event }>();
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('menu') menu?: Menu;

  taskDialogVisible = false;
  isSavingTask = false;
  menuItems: MenuItem[] = [];
  bannerColor = '#dbeafe';

  newTask: Task = {
    title: '',
    description: '',
    status: TaskStatus.TODO,
    projectId: 0,
    collaboratorEmail: '',
    priority: undefined,
    deadline: undefined
  };

  priorities: Priority[] = [Priority.LOW, Priority.MEDIUM, Priority.HIGH];

  constructor(
    private taskService: TaskService,
    private projectService: ProjectService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const archived = !!this.project.archived;
    this.bannerColor = this.resolveBannerColor();
    this.menuItems = [
      {
        label: archived ? 'Unarchive' : 'Archive',
        icon: archived ? 'pi pi-folder-open' : 'pi pi-building-columns',
        command: (event) => this.archive.emit({ id: this.project.id, archived: !archived, nativeEvent: event.originalEvent as Event })
      },
      {
        label: 'Edit',
        icon: 'pi pi-pencil',
        command: () => this.edit.emit(this.project)
      },
      {
        label: 'Delete',
        icon: 'pi pi-trash',
        command: (event) => this.delete.emit({ id: this.project.id, nativeEvent: event.originalEvent as Event })
      },
      {
        label: 'Upload File',
        icon: 'pi pi-upload',
        command: () => this.openFilePicker()
      }
    ];
  }

  toggleMenu(event: Event) {
    this.menu?.toggle(event);
  }

  onMenuShow() {
    const container = this.menu?.container as HTMLElement | undefined;
    const target = this.menu?.target as HTMLElement | undefined;

    if (!container || !target) {
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const overlayWidth = container.offsetWidth;

    const left = targetRect.right - overlayWidth;
    const top = targetRect.bottom;

    container.style.left = `${Math.max(left, 0)}px`;
    container.style.top = `${Math.max(top, 0)}px`;
    container.style.transformOrigin = 'top right';
  }

  openDialog() {
    if (this.project.archived) {
      return;
    }

    this.newTask = {
      title: '',
      description: '',
      status: TaskStatus.TODO,
      projectId: this.project.id,
      collaboratorEmail: '',
      priority: undefined,
      deadline: undefined
    };
    this.isSavingTask = false;
    this.taskDialogVisible = true;
    this.cdr.markForCheck();
  }

  saveTask() {
    if (this.isSavingTask || !this.newTask.title.trim()) {
      return;
    }

    const taskToCreate: Task = { ...this.newTask };

    this.isSavingTask = true;
    this.taskDialogVisible = false;
    this.cdr.detectChanges();

    this.taskService.createTask(taskToCreate).subscribe({
      next: () => {
        this.isSavingTask = false;
        this.newTask = {
          title: '',
          description: '',
          status: TaskStatus.TODO,
          projectId: this.project.id,
          collaboratorEmail: '',
          priority: undefined,
          deadline: undefined
        };
        this.cdr.detectChanges();
      },
      error: () => {
        this.isSavingTask = false;
        this.newTask = taskToCreate;
        this.taskDialogVisible = true;
        this.cdr.detectChanges();
      }
    });
  }

  openFilePicker() {
    this.fileInput?.nativeElement.click();
  }

  priorityLabel(priority: Priority): string {
    switch (priority) {
      case Priority.LOW: return 'Low';
      case Priority.MEDIUM: return 'Medium';
      case Priority.HIGH: return 'High';
      default: return priority;
    }
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;

    this.projectService.uploadAttachment(this.project.id, file).subscribe((updated: any) => {
      this.project = updated;
    });
  }

  private resolveBannerColor(): string {
    const palette = [
      '#fecdd3',
      '#fde68a',
      '#bfdbfe',
      '#c7d2fe',
      '#bbf7d0',
      '#fbcfe8',
      '#fed7aa',
      '#a7f3d0'
    ];
    const seed = `${this.project.id ?? ''}${this.project.name ?? ''}`;
    const index = Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0) % palette.length;
    return palette[index];
  }
}
