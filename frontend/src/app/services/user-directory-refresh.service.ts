import { Injectable } from '@angular/core';
import { Observable, Subject, fromEvent, merge } from 'rxjs';
import { filter, map } from 'rxjs/operators';

/**
 * When a non-admin user updates their profile (PUT /user/me), admin views that list users
 * should refetch. Same-tab uses Subject; other tabs use storage events.
 */
@Injectable({ providedIn: 'root' })
export class UserDirectoryRefreshService {
  private static readonly STORAGE_KEY = 'taskflow:user-directory-stamp';

  private readonly sameTab$ = new Subject<void>();

  /** Call after a successful self-service profile update. */
  notifyProfileOrDirectoryChanged(): void {
    this.sameTab$.next();
    try {
      localStorage.setItem(UserDirectoryRefreshService.STORAGE_KEY, String(Date.now()));
    } catch {
      /* private mode / quota */
    }
  }

  /** Admin pages subscribe to refetch user lists. */
  get directoryShouldRefresh$(): Observable<void> {
    return merge(
      this.sameTab$.asObservable(),
      fromEvent<StorageEvent>(window, 'storage').pipe(
        filter((e) => e.key === UserDirectoryRefreshService.STORAGE_KEY),
        map(() => undefined)
      )
    );
  }
}
