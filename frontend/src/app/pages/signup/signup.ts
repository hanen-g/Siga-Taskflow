import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Self-service registration is disabled. Old /signup links redirect to login.
 */
@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule],
  template: '',
})
export class Signup implements OnInit {
  constructor(private router: Router) {}

  ngOnInit(): void {
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}
