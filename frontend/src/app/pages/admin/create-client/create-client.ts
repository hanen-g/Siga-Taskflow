import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-create-client-page',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, CardModule, ButtonModule, MessageModule, ToastModule],
  templateUrl: './create-client.html',
  styleUrls: ['./create-client.css'],
  providers: [MessageService]
})
export class CreateClientPage {
  form = { firstName: '', lastName: '', email: '' };
  createLoading = false;
  createError: string | null = null;

  constructor(
    private userService: UserService,
    private messageService: MessageService
  ) {}

  submit(): void {
    this.createError = null;

    if (!this.form.firstName?.trim() || !this.form.lastName?.trim() || !this.form.email?.trim()) {
      this.createError = 'Please fill in first name, last name, and email.';
      return;
    }

    this.createLoading = true;
    this.userService
      .createAdminUser({
        firstName: this.form.firstName.trim(),
        lastName: this.form.lastName.trim(),
        email: this.form.email.trim().toLowerCase(),
        role: 'CLIENT',
        skillIds: []
      })
      .subscribe({
        next: (res) => {
          this.createLoading = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Client created',
            detail: res?.message ?? 'Client account created successfully.',
            life: 1500
          });
          this.form = { firstName: '', lastName: '', email: '' };
        },
        error: (err) => {
          this.createLoading = false;
          const msg = err?.error?.message;
          this.createError = typeof msg === 'string' ? msg : 'Could not create the client account.';
        }
      });
  }
}
