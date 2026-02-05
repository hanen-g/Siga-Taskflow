import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');
    
    // If no token or user data, redirect to login
    if (!token || !userJson) {
      this.router.navigate(['/login']);
      return false;
    }

    try {
      const user = JSON.parse(userJson);
      const allowedRoles = route.data?.['roles'] as string[] | undefined;

      // Check if route has role restrictions
      if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        // Redirect to appropriate dashboard based on role
        if (user.role === 'PROJECT_MANAGER') {
          this.router.navigate(['/dashboard/pm']);
        } else {
          this.router.navigate(['/dashboard/collab']);
        }
        return false;
      }

      return true;
    } catch (error) {
      // If user data is corrupted, redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      this.router.navigate(['/login']);
      return false;
    }
  }
}