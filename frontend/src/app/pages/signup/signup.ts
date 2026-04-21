import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CardModule,
    MessageModule,
    SelectModule,
    CommonModule
  ],
  templateUrl: './signup.html',
  styleUrls: ['./signup.css']
})
export class Signup {

  firstName = '';
  lastName = '';
  email = '';
  password = '';
  role = 'COLLABORATOR';
  message = '';
  isLoading = false;

  roles = [
    { label: 'Project Manager', value: 'PROJECT_MANAGER' },
    { label: 'Collaborator', value: 'COLLABORATOR' },
    { label: 'Client', value: 'CLIENT' },
    { label: 'Admin', value: 'ADMIN' }
  ];

  constructor(
    private api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  signup() {
    if (!this.firstName || !this.lastName || !this.email || !this.password) {
      this.message = 'Please fill in all fields';
      return;
    }

    this.isLoading = true;

    this.api.signup({
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      password: this.password,
      role: this.role
    }).subscribe({
      next: (res) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify({
          id: res.id,
          email: res.email,
          firstName: res.firstName,
          lastName: res.lastName,
          role: res.role
        }));

        this.isLoading = false;
        this.router.navigate(['/login']);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 409) {
          this.message = 'This email is already registered. Please login or use another email.';
        } else if (err.status === 400) {
          this.message = err.error?.message || 'Invalid signup data. Please check the fields and try again.';
        } else {
          this.message = err.error?.error || err.error?.message || 'Signup failed. Please try again.';
        }

        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
