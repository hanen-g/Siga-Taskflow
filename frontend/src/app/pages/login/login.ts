import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { RippleModule } from 'primeng/ripple';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { RouterModule,Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api';
import { Location } from '@angular/common';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ButtonModule,
    InputTextModule,
    PasswordModule,
    FormsModule,
    RouterLink,
    RouterModule,
    IconFieldModule,
    InputIconModule,
    RippleModule,
    CardModule,
    MessageModule,
    ToastModule,
    CommonModule,
  ],
  providers: [MessageService],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class Login implements OnInit {
  username = '';
  password = '';
  message = '';
  isLoading = false;

  constructor(
    private api: ApiService,
    private router: Router,
    private location: Location,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    // Check if already authenticated and redirect
    const token = localStorage.getItem('token');
    if (token) {
      this.router.navigate(['/dashboard']);
    }
  }

  login() {
    if (!this.username || !this.password) {
      this.message = 'Please fill in all fields';
      return;
    }

    this.isLoading = true;
    this.message = '';
    
    this.api.login(this.username, this.password).subscribe({
      next: (res) => {
        // Store token and user data before navigation
        localStorage.setItem('token', res.token);
        localStorage.setItem(
          'user',
          JSON.stringify({
            id: res.id,
            email: res.email,
            firstName: res.firstName,
            lastName: res.lastName,
            role: res.role,
          }),
        );
        
        // Navigate based on user role
        if (res.role === 'PROJECT_MANAGER') {
          this.router.navigate(['/dashboard/pm']);
        } else if (res.role === 'COLLABORATOR') {
          this.router.navigate(['/dashboard/collab']);
        }
         else if (res.role === 'ADMIN') {
  this.router.navigate(['/dashboard/admin']);
}
 else {
          // Fallback to generic dashboard
          this.router.navigate(['/dashboard']);
        }
       
      },
      error: (err) => {
        console.error('Login error:', err);
        if (err.status === 401) {
          this.message = 'Invalid email or password';
        } else if (err.status === 0) {
          this.message = 'Unable to connect to server. Please check if backend is running.';
        } else {
          this.message = err.error?.message || 'An error occurred during login';
        }
        this.messageService.add({
          severity: 'error',
          summary: 'Login Failed',
          detail: this.message,
          life: 3000
        });
        this.isLoading = false;
      },
    });
  }
}
