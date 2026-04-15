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
  logoSrc = '/assets/images/LOGO_SIGA.png';
  private readonly fallbackLogoSrc = 'https://www.siga.tn/wp-content/uploads/2018/02/NV_LOGO_SIGA_2_69.png';

  constructor(
    private api: ApiService,
    private router: Router,
    private location: Location,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }
    const role = this.api.getRole();
    if (!role) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return;
    }
    this.navigateByRole(role);
  }

  private navigateByRole(role: string): void {
    if (role === 'PROJECT_MANAGER') {
      this.router.navigate(['/dashboard/pm']);
    } else if (role === 'COLLABORATOR') {
      this.router.navigate(['/dashboard/collab']);
    } else if (role === 'ADMIN') {
      this.router.navigate(['/dashboard/admin']);
    } else {
      this.router.navigate(['/dashboard/collab']);
    }
  }

  handleLogoError(event: Event) {
    const img = event.target as HTMLImageElement | null;
    if (!img) {
      return;
    }

    if (img.src !== this.fallbackLogoSrc) {
      this.logoSrc = this.fallbackLogoSrc;
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
        
        this.navigateByRole(res.role);
       
      },
      error: (err) => {
        if (err.status === 401) {
          this.message = 'Invalid email or password';
        } else if (err.status === 403) {
          this.message = err.error?.message || 'This account is deactivated. Please contact an administrator.';
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
