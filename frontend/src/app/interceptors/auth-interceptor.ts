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
      const isAuthFailure = err.status === 401 || err.status === 403;

      if (isAuthFailure && !isPublicAuthCall) {
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
