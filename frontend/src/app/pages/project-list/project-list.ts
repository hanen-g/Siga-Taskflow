import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { Observable, forkJoin, of } from 'rxjs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../services/project.service';
import { TaskService } from '../../services/task.service';
import { map, switchMap, tap } from 'rxjs/operators';
import { MenuModule } from 'primeng/menu';

@Component({
  standalone: true,
  selector: 'app-project-list',
  templateUrl: './project-list.html',
imports: [CommonModule, TableModule, ButtonModule, DialogModule, InputTextModule, FormsModule, MenuModule]})

export class ProjectList {
  projects$: Observable<any[]>;

  displayDialog = false;
  newProject = { 
  name: '', 
  description: ''};

  isEditMode = false;
  selectedProjectId: number | null = null;

  selectedTask: any = null;
  taskDialogVisible = false;

  tasksMap: { [projectId: number]: any[] } = {};


  constructor( private projectService: ProjectService,
  private taskService: TaskService) {
    this.projects$ = this.projectService.myProjects();
  }
    showDialog() {
    this.displayDialog = true;
  }

 loadProjects() {
  this.projectService.myProjects().subscribe(projects => {

    projects.forEach(project => {
      this.taskService.getTasksByProject(project.id)
        .subscribe(tasks => project.tasks = tasks);
    });

    this.projects$ = new Observable(observer => {
      observer.next(projects);
      observer.complete();
    });

  });
}

closeDialog() {
  this.displayDialog = false;
  this.isEditMode = false;
  this.newProject = { name: '', description: ''};
}
 createProject() {
  this.projectService.createProject(this.newProject).subscribe(() => {
    this.displayDialog = false;
    this.newProject = { name: '', description: '' }; 
    this.loadProjects(); 
  });
}
editProject(project: any) {
  this.isEditMode = true;
  this.selectedProjectId = project.id;
  this.newProject = { ...project }; 
  this.displayDialog = true;
}

saveProject() {
  if (this.isEditMode) {
    this.projectService.updateProject(this.selectedProjectId!, this.newProject).subscribe(() => {
      this.closeDialog();
      this.loadProjects();
    });
  } else {
    this.createProject();
  }
}

deleteProject(id: number) {
  
  if (confirm('Are you sure?')) {
    this.projectService.deleteProject(id).subscribe({
      next: () => {
        console.log('Delete successful');
        this.loadProjects();
      },
      error: (err) => {
        console.error('Delete failed', err);
      }
    });
  }
}

loadTasks(projectId: number) {
  this.taskService.getTasksByProject(projectId).subscribe(tasks => {
    this.tasksMap[projectId] = tasks;
  });
}

openTaskDialog(task: any) {
  this.selectedTask = task;
  this.taskDialogVisible = true;
}

getProjectMenu(project: any) {
  return [
    {
      label: 'Edit',
      icon: 'pi pi-pencil',
      command: () => this.editProject(project)
    },
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      command: () => this.deleteProject(project.id)
    }
  ];
}
trackProjects(projects: any[]) {
  projects.forEach(p => this.loadTasks(p.id));
  return projects;
}


}