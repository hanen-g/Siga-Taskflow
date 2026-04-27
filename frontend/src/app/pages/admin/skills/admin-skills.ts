import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { SkillService } from '../../../services/skill.service';
import { Skill } from '../../../models/skill.model';
import { AppLoaderComponent } from '../../../layout/app-loader';

@Component({
  selector: 'app-admin-skills',
  standalone: true,
  templateUrl: './admin-skills.html',
  styleUrls: ['./admin-skills.css'],
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    ToastModule,
    TableModule,
    AppLoaderComponent,
  ],
  providers: [MessageService],
})
export class AdminSkillsPage implements OnInit {
  skills: Skill[] | null = null;
  newSkillName = '';
  saving = false;

  constructor(
    private skillService: SkillService,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.skills = null;
    this.skillService.getAllSkillsRefreshed().subscribe({
      next: (s) => (this.skills = s),
      error: () => {
        this.skills = [];
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Could not load skills.',
        });
      },
    });
  }

  addSkill(): void {
    const name = this.newSkillName.trim();
    if (!name) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Enter a skill name.' });
      return;
    }
    this.saving = true;
    this.skillService.createSkill(name).subscribe({
      next: () => {
        this.saving = false;
        this.newSkillName = '';
        this.messageService.add({ severity: 'success', summary: 'Created', detail: 'Skill added.' });
        this.reload();
      },
      error: (err) => {
        this.saving = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message ?? err.error?.error ?? 'Could not create skill.',
        });
      },
    });
  }

  remove(skill: Skill): void {
    this.skillService.deleteSkill(skill.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Removed', detail: 'Skill deleted.' });
        this.reload();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message ?? err.error?.error ?? 'Could not delete skill.',
        });
      },
    });
  }
}
