import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { FileAccessService } from './file-access.service';

/**
 * Fetches profile picture paths as authenticated blobs and caches object URLs.
 * Emits {@link imageReady} when a new URL is available so views can run change detection.
 */
@Injectable({ providedIn: 'root' })
export class ProfilePictureCacheService {
  private readonly urls = new Map<string, string>();
  private readonly loading = new Set<string>();
  private readonly imageReady$ = new Subject<void>();

  readonly imageReady = this.imageReady$.asObservable();

  constructor(private readonly fileAccess: FileAccessService) {}

  /**
   * Returns a displayable URL immediately when known; otherwise starts fetch and returns undefined until ready.
   * URLs under `/api/files/` are always loaded with the app HttpClient (JWT), including when stored as absolute
   * `http(s)://…/api/files/…` — raw absolute URLs would load without Authorization and fail for admins.
   */
  getDisplayUrl(profilePicture: string | null | undefined): string | undefined {
    if (!profilePicture) {
      return undefined;
    }
    const p = profilePicture.trim();
    if (!p) {
      return undefined;
    }
    if (p.startsWith('blob:') || p.startsWith('data:')) {
      return p;
    }

    const apiFilePath = this.normalizeApiFilePath(p);
    if (apiFilePath) {
      const cached = this.urls.get(apiFilePath);
      if (cached) {
        return cached;
      }
      if (!this.loading.has(apiFilePath)) {
        this.loading.add(apiFilePath);
        this.fileAccess.fetchFileBlob(apiFilePath).subscribe({
          next: (blob) => {
            this.loading.delete(apiFilePath);
            this.urls.set(apiFilePath, URL.createObjectURL(blob));
            this.imageReady$.next();
          },
          error: () => {
            this.loading.delete(apiFilePath);
            this.imageReady$.next();
          }
        });
      }
      return undefined;
    }

    if (p.startsWith('http://') || p.startsWith('https://')) {
      return p;
    }

    return undefined;
  }

  /** `/api/files/…` relative path used as cache key, or null if not an API file reference. */
  private normalizeApiFilePath(input: string): string | null {
    const t = input.trim();
    let path: string;
    if (t.startsWith('http://') || t.startsWith('https://')) {
      try {
        const u = new URL(t);
        path = u.pathname + (u.search || '');
      } catch {
        return null;
      }
    } else {
      path = t.startsWith('/') ? t : `/${t}`;
    }
    const marker = '/api/files/';
    const i = path.indexOf(marker);
    if (i !== -1) {
      return path.slice(i);
    }
    // Same as backend: bare stored filename with no slash → /api/files/<name>
    if (!t.startsWith('http://') && !t.startsWith('https://') && !t.includes('/') && !t.includes('\\')) {
      return `${marker}${t}`;
    }
    return null;
  }

  revokeAll(): void {
    for (const url of this.urls.values()) {
      URL.revokeObjectURL(url);
    }
    this.urls.clear();
    this.loading.clear();
    this.imageReady$.next();
  }
}
