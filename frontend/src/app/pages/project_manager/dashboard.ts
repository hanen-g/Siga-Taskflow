import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { ApiService, UserProfile } from '../../services/api';

@Component({
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  selector: 'app-dashboard-pm',
  templateUrl: './dashboard.html'
})
export class PMDashboard implements OnInit {
  user: UserProfile | null = null;
  error = '';



  constructor(private api: ApiService, private router: Router) {}

  ngOnInit() {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        this.user = JSON.parse(storedUser);
      } catch (e) {
        console.error('Failed to parse user data:', e);
        this.router.navigate(['/login']);
      }
    } else {
      this.router.navigate(['/login']);
    }
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }
}

