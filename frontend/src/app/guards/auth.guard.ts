import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private router: Router) {}

  private getRoleFromToken(): string | null {
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role;
    } catch {
      return null;
    }
  }

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const token = localStorage.getItem('token');

    if (!token) {
      this.router.navigate(['/login']);
      return false;
    }

    const role = this.getRoleFromToken();
    const allowedRoles = route.data?.['roles'] as string[] | undefined;

    if (!role) {
      this.router.navigate(['/login']);
      return false;
    }

    if (allowedRoles && !allowedRoles.includes(role)) {
      if (role === 'PROJECT_MANAGER') {
        this.router.navigate(['/dashboard/pm']);
      } else {
        this.router.navigate(['/dashboard/collab']);
      }
      return false;
    }

    return true;
  }
}
