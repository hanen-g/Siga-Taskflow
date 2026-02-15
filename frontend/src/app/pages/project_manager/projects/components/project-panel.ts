import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelModule } from 'primeng/panel';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { FormsModule } from '@angular/forms';

import { TaskService } from '../../../../services/task.service';
import { Project } from '../models/project.model';
import { TaskList } from './task-list';
import { Task, TaskStatus } from '../models/task.model';

@Component({
  selector: 'app-project-panel',
  standalone: true,
  template: `
<p-panel [header]="project.name" [toggleable]="true">

  <ng-template pTemplate="header">
    <div class="flex justify-content-between align-items-center w-full">
      <div class="font-bold">{{ project.description }}</div>

      <p-menu #menu [popup]="true" [model]="menuItems"></p-menu>
      <button pButton icon="pi pi-ellipsis-v"
              class="p-button-text"
              (click)="menu.toggle($event); $event.stopPropagation()">
      </button>
    </div>
  </ng-template>

  <!-- Task list -->
  <app-task-list [projectId]="project.id"></app-task-list>

  <!-- Button to open new task dialog -->
  <button pButton label="New Task" icon="pi pi-plus" class="mt-2" (click)="openNewTaskDialog()"></button>

</p-panel>

<!-- Task creation dialog -->
<p-dialog header="New Task"
          [(visible)]="taskDialogVisible"
          [modal]="true"
          [draggable]="false"
          [resizable]="false"
          [style]="{width:'400px'}">

  <div class="flex flex-column gap-3">

    <div class="flex flex-column">
      <label>Name</label>
      <input pInputText [(ngModel)]="newTask.title" placeholder="Enter task name">
    </div>

    <div class="flex flex-column">
      <label>Description</label>
      <textarea pInputTextarea [(ngModel)]="newTask.description" rows="4" placeholder="Enter task description"></textarea>
    </div>

    <div class="flex flex-column">
  <label>Collaborator Email</label>
  <input pInputText [(ngModel)]="newTask.collaboratorEmail" placeholder="user@example.com">
  </div>
    <button pButton label="Create Task" class="p-button-success mt-2" (click)="saveTask()"></button>

  </div>
</p-dialog>

  `,
  styleUrls: ['../projects.css'],

  imports: [
    CommonModule,
    PanelModule,
    ButtonModule,
    MenuModule,
    TaskList,
    DialogModule,
    InputTextModule,
    TextareaModule,
    FormsModule
  ]
})
export class ProjectPanel implements OnInit {

  @Input() project!: Project;
  @Output() edit = new EventEmitter<Project>();
  @Output() delete = new EventEmitter<{ id: number, nativeEvent: Event }>();

  taskDialogVisible = false;
  newTask: Task = { title: '', description: '', status: TaskStatus.TODO, projectId: 0, collaboratorEmail: '' };

  menuItems: MenuItem[] = [];

  constructor(private taskService: TaskService) {}

  ngOnInit() {
    this.menuItems = [
      {
        label: 'Edit',
        icon: 'pi pi-pencil',
        command: () => this.edit.emit(this.project)
      },
      {
        label: 'Delete',
        icon: 'pi pi-trash',
        command: (event) => this.delete.emit({ id: this.project.id, nativeEvent: event.originalEvent as Event })
      }
    ];
  }

resetForm() {
  this.newTask = {
    title: '',
    description: '',
    status: TaskStatus.TODO,
    projectId: this.project.id,
    collaboratorEmail: ''
  };
}
  openNewTaskDialog() {
  this.resetForm();
  this.taskDialogVisible = true;
}


saveTask() {
  if (!this.newTask.title?.trim()) return;

  this.taskService.createTask(this.newTask).subscribe({
    next: () => {
      this.taskDialogVisible = false;
      this.resetForm();

      window.dispatchEvent(new CustomEvent('taskCreated'));
    },
    error: (error) => console.error('Error creating task:', error)
  });
}




}
