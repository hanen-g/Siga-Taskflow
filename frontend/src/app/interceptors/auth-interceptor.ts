import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  const token = localStorage.getItem('token');
  const isPublicAuthCall =
    req.url.includes('/api/auth/login') || req.url.includes('/api/auth/signup');

  if (token && !isPublicAuthCall) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Only 401 = missing/invalid/expired credentials. 403 = forbidden action for an authenticated user
      // (e.g. role-based); clearing the session here logged collaborators out incorrectly.
      const isUnauthorized = err.status === 401;

      if (isUnauthorized && !isPublicAuthCall) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setTimeout(() => {
          void router.navigate(['/login']);
        }, 0);
      }

      return throwError(() => err);
    })
  );
};
