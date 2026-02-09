import { Component, OnInit } from '@angular/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../../services/project.service';

@Component({
  standalone: true,
  selector: 'app-project-list',
  imports: [TableModule, ButtonModule, DialogModule, InputTextModule, FormsModule],
  templateUrl: './project-list.html',
  styleUrl: './project-list.css',
})
export class ProjectList{
projects: any[] = [];
  displayDialog = false;

  newProject = {
    name: '',
    description: ''
  };

  constructor(private projectService: ProjectService) {}

  ngOnInit() {
    this.loadProjects();
  }

  showDialog() {
    this.displayDialog = true;
  }

  loadProjects() {
    this.projectService.getProjects().subscribe(data => {
      this.projects = data;
    });
  }

  createProject() {
    this.projectService.createProject(this.newProject).subscribe(() => {
      this.displayDialog = false;
      this.newProject = { name: '', description: '' };
      this.loadProjects();
    });
  }
}

