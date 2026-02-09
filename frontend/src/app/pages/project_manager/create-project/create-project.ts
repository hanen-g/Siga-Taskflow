import { Component } from '@angular/core';
import { ProjectService } from '../../../services/project.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-create-project',
  templateUrl: './create-project.html',
  imports: [FormsModule, CommonModule]
})
export class CreateProject {

  /*project = {
    name: '',
    description: ''
  };

  message = '';

  constructor(private projectService: ProjectService) {}

  createProject() {
    this.projectService.createProject(this.project).subscribe({
      next: () => {
        this.message = 'Project created successfully';
        this.project = { name: '', description: '' };
      },
      error: () => {
        this.message = 'Error creating project';
      }
    });
  }*/
}
