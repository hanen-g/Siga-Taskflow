import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { Skill } from '../models/skill.model';

@Injectable({ providedIn: 'root' })
export class SkillService {
  private readonly base = 'http://localhost:8080/api';
  private listCache$?: Observable<Skill[]>;

  constructor(private readonly http: HttpClient) {}

  /** All skills in the catalog (for pickers; cached per session). */
  getAllSkillsRefreshed(): Observable<Skill[]> {
    this.listCache$ = undefined;
    return this.getAllSkills();
  }

  getAllSkills(): Observable<Skill[]> {
    if (!this.listCache$) {
      this.listCache$ = this.http.get<Skill[]>(`${this.base}/skills`).pipe(shareReplay(1));
    }
    return this.listCache$;
  }

  /** Admin view with description, created date, usage counts. */
  getAdminSkills(): Observable<Skill[]> {
    return this.http.get<Skill[]>(`${this.base}/admin/skills/list`);
  }

  getMySkills(): Observable<Skill[]> {
    return this.http.get<Skill[]>(`${this.base}/user/me/skills`);
  }

  putMySkills(skillIds: number[]): Observable<Skill[]> {
    this.listCache$ = undefined;
    return this.http.put<Skill[]>(`${this.base}/user/me/skills`, { skillIds });
  }

  createSkill(name: string, description?: string | null): Observable<Skill> {
    this.listCache$ = undefined;
    const body: { name: string; description?: string } = { name };
    const d = description?.trim();
    if (d) {
      body.description = d;
    }
    return this.http.post<Skill>(`${this.base}/admin/skills`, body);
  }

  updateSkill(id: number, payload: { name: string; description?: string | null }): Observable<Skill> {
    this.listCache$ = undefined;
    const body: { name: string; description?: string } = { name: payload.name.trim() };
    if (payload.description !== undefined) {
      body.description = payload.description?.trim() ?? '';
    }
    return this.http.put<Skill>(`${this.base}/admin/skills/${id}`, body);
  }

  archiveSkill(id: number): Observable<void> {
    this.listCache$ = undefined;
    return this.http.post<void>(`${this.base}/admin/skills/${id}/archive`, {});
  }
}
