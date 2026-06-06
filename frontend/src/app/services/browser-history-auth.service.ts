import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { WebsocketService } from './websocket.service';

@Injectable({ providedIn: 'root' })
export class BrowserHistoryAuthService {
  private readonly router = inject(Router);
  private readonly ws = inject(WebsocketService);
  private readonly ngZone = inject(NgZone);

  constructor() {
    const destroyRef = inject(DestroyRef);

    this.router.events
      .pipe(
        filter((e): e is NavigationStart => e instanceof NavigationStart),
        filter(
          (e) =>
            (e.navigationTrigger === 'popstate' || e.navigationTrigger === 'hashchange') &&
            this.isLoginPath(e.url),
        ),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => this.clearClientSession());

    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) {
        return;
      }
      const path = globalThis.location.pathname;
      const isPublic = path.includes('/login');
      if (!isPublic && !localStorage.getItem('token')) {
        this.ngZone.run(() => {
          this.router.navigate(['/login'], { replaceUrl: true });
        });
      }
    };
    window.addEventListener('pageshow', onPageShow);
    destroyRef.onDestroy(() => window.removeEventListener('pageshow', onPageShow));
  }

  private isLoginPath(url: string): boolean {
    const path = url.split('?')[0].replace(/\/$/, '') || '/';
    return path === '/login' || path === 'login';
  }

  private clearClientSession(): void {
    this.ws.disconnect();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}
