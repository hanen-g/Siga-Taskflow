import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CardModule,
    MessageModule,
    SelectModule,
  ],
  templateUrl: './signup.html',
  styleUrls: ['./signup.css'],
})
export class Signup {
  private readonly cdr = inject(ChangeDetectorRef);

  firstName = '';
  lastName = '';
  email = '';
  password = '';
  role = 'COLLABORATOR';
  readonly roles = [
    { label: 'Project Manager', value: 'PROJECT_MANAGER' },
    { label: 'Collaborator', value: 'COLLABORATOR' },
    { label: 'Client', value: 'CLIENT' },
  ];
  message = '';
  isLoading = false;

  constructor(
    private api: ApiService,
    private router: Router,
  ) {}

  signup() {
    if (this.isLoading) {
      return;
    }
    const pwd = this.password ?? '';
    if (
      !this.firstName?.trim() ||
      !this.lastName?.trim() ||
      !this.email?.trim() ||
      !pwd
    ) {
      this.message = 'Please fill in all fields';
      return;
    }
    if (pwd.length < 6) {
      this.message = 'Password must be at least 6 characters.';
      return;
    }
    if (!this.role) {
      this.message = 'Please select a role';
      return;
    }

    this.isLoading = true;
    this.message = '';

    this.api.signup({
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      email: this.email.trim(),
      password: pwd,
      role: this.role,
    }).subscribe({
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
        this.isLoading = false;
        const msg =
          err.status === 0
            ? 'Unable to reach server. Try http://localhost:4200 if you used 127.0.0.1 or another host, ensure the backend is running on port 8080.'
            : (() => {
                const body = err.error;
                return (
                  (typeof body === 'object' &&
                    body &&
                    (body.message ?? body.error)) ||
                  err.message ||
                  'Unable to create account'
                );
              })();
        // Next macrotick avoids NG0100 (message binds after Angular's dev verification pass).
        setTimeout(() => {
          this.message = msg;
          try {
            this.cdr.detectChanges();
          } catch {
            /** ignore teardown */
          }
        }, 0);
      },
    });
  }

  private navigateByRole(role: string): void {
    if (role === 'PROJECT_MANAGER') {
      this.router.navigate(['/dashboard/pm']);
    } else if (role === 'COLLABORATOR') {
      this.router.navigate(['/dashboard/collab']);
    } else if (role === 'ADMIN') {
      this.router.navigate(['/dashboard/admin']);
    } else if (role === 'CLIENT') {
      this.router.navigate(['/dashboard/client']);
    } else {
      this.router.navigate(['/dashboard/collab']);
    }
  }
}
