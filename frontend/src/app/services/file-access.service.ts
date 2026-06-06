import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FileAccessService {
  private readonly apiOrigin = 'http://localhost:8080';

  constructor(private readonly http: HttpClient) {}

  /** GET file with JWT (via auth interceptor); use blob URL to open in a new tab. */
  fetchFileBlob(fileUrlOrPath: string): Observable<Blob> {
    const url = this.toAbsoluteUrl(fileUrlOrPath);
    return this.http.get(url, { responseType: 'blob' });
  }

  private toAbsoluteUrl(fileUrlOrPath: string): string {
    const trimmed = fileUrlOrPath.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${this.apiOrigin}${path}`;
  }
}
