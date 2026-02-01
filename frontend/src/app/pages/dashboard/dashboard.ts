import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  template: `
    <h2>Dashboard</h2>
    <p>{{ message }}</p>
  `
})
export class Dashboard implements OnInit {

  message = '';

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getProfile().subscribe(res => {
      this.message = res;
    });
  }
}
