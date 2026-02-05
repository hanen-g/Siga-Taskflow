import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-dashboard-redirect',
  template: ''
})
export class DashboardRedirect implements OnInit {
  constructor(private router: Router) {}

  ngOnInit() {
    const userJson = localStorage.getItem('user');
    if (!userJson) {
      this.router.navigate(['/login']);
      return;
    }
    const user = JSON.parse(userJson);
    if (user.role === 'PROJECT_MANAGER') {
      this.router.navigate(['/dashboard/pm']);
    } else {
      this.router.navigate(['/dashboard/collab']);
    }
  }
}