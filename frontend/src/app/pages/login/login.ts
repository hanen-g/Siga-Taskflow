import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { RippleModule } from 'primeng/ripple';

import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ButtonModule, CheckboxModule, InputTextModule, PasswordModule, FormsModule,RouterLink, RouterModule, RippleModule],
  templateUrl: './login.html',
})
export class Login {

  email = '';
  password = '';
  message = '';

  constructor(private api: ApiService, private router: Router) {}

  login() {
    this.api.login(this.email, this.password).subscribe({
      next: (res) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify({
          id: res.id,
          email: res.email,
          firstName: res.firstName,
          lastName: res.lastName,
          role: res.role
        }));
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.message = 'Invalid credentials';
      }
    });
  }
}
