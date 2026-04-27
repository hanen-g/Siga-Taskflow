import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { Skill } from '../models/skill.model';

@Injectable({ providedIn: 'root' })
export class SkillService {
  private base = 'http://localhost:8080/api';
  private listCache$?: Observable<Skill[]>;

  constructor(private http: HttpClient) {}

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

  getMySkills(): Observable<Skill[]> {
    return this.http.get<Skill[]>(`${this.base}/user/me/skills`);
  }

  putMySkills(skillIds: number[]): Observable<Skill[]> {
    this.listCache$ = undefined;
    return this.http.put<Skill[]>(`${this.base}/user/me/skills`, { skillIds });
  }

  createSkill(name: string): Observable<Skill> {
    this.listCache$ = undefined;
    return this.http.post<Skill>(`${this.base}/admin/skills`, { name });
  }

  deleteSkill(id: number): Observable<void> {
    this.listCache$ = undefined;
    return this.http.delete<void>(`${this.base}/admin/skills/${id}`);
  }
}
