import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService, UserProfile } from '../../services/api';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [RouterLink],
  template: `
    <h2>Dashboard</h2>
    @if (user) {
      <p>Welcome, {{ user.firstName }} {{ user.lastName }}!</p>
      <p>Email: {{ user.email }} | Role: {{ user.role }}</p>
    } @else if (error) {
      <p>{{ error }}</p>
    } @else {
      <p>Loading...</p>
    }
    <a routerLink="/login" (click)="logout()">Log out</a>
  `
})
export class Dashboard implements OnInit {

  user: UserProfile | null = null;
  error = '';

  constructor(private api: ApiService, private router: Router) {}

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  ngOnInit() {
    this.api.getProfile().subscribe({
      next: (res) => {
        this.user = res;
      },
      error: () => {
        this.error = 'Please log in.';
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    });
  }
}
