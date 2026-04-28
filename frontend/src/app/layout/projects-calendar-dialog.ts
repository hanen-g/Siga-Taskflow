import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ProjectService } from '../services/project.service';

export interface CalendarEventItem {
  trackId: string;
  kind: 'start' | 'deadline';
  projectId: number;
  projectName: string;
}

export interface CalendarCell {
  day: number;
  inMonth: boolean;
  isToday: boolean;
  dateKey: string;
  events: CalendarEventItem[];
}

export interface MonthView {
  key: string;
  label: string;
  weeks: CalendarCell[][];
}

@Component({
  selector: 'app-projects-calendar-dialog',
  standalone: true,
  imports: [CommonModule, RouterModule, DialogModule, ButtonModule],
  templateUrl: './projects-calendar-dialog.html',
  styleUrls: ['./projects-calendar-dialog.css']
})
export class ProjectsCalendarDialog implements OnChanges {
  private projectService = inject(ProjectService);
  private cdr = inject(ChangeDetectorRef);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  loading = false;
  loadError: string | null = null;
  projects: Array<{ id: number; name: string; startDate?: string; deadline?: string }> = [];

  viewAnchor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  leftMonth: MonthView = { key: '', label: '', weeks: [] };
  rightMonth: MonthView = { key: '', label: '', weeks: [] };

  readonly weekDayLabels = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.loadProjects();
    }
  }

  onDialogVisibleChange(v: boolean): void {
    this.visibleChange.emit(v);
  }

  onHide(): void {
    this.visibleChange.emit(false);
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  get rangeTitle(): string {
    if (!this.leftMonth.label || !this.rightMonth.label) {
      return '';
    }
    return `${this.leftMonth.label} – ${this.rightMonth.label}`;
  }

  get hasAnyProjectDates(): boolean {
    return this.projects.some((p) => !!p.startDate || !!p.deadline);
  }

  shiftView(delta: number): void {
    this.viewAnchor = this.addMonths(this.viewAnchor, delta);
    this.rebuildCalendars();
  }

  projectDetailPath(projectId: number): string {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const role = JSON.parse(userData)?.role;
        if (role === 'ADMIN') {
          return `/dashboard/admin/projects/${projectId}`;
        }
        if (role === 'COLLABORATOR') {
          return `/dashboard/collab/projects/${projectId}`;
        }
        if (role === 'CLIENT') {
          return `/dashboard/client/projects/${projectId}`;
        }
      } catch {
        /* ignore */
      }
    }
    return `/dashboard/pm/projects/${projectId}`;
  }

  private loadProjects(): void {
    this.loading = true;
    this.loadError = null;
    this.cdr.markForCheck();
    this.projectService.myProjects().subscribe({
      next: (list) => {
        this.projects = Array.isArray(list) ? list : [];
        this.loading = false;
        this.rebuildCalendars();
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.loadError = 'Impossible de charger les projets. Réessayez plus tard.';
        this.cdr.markForCheck();
      }
    });
  }

  private rebuildCalendars(): void {
    const y = this.viewAnchor.getFullYear();
    const m = this.viewAnchor.getMonth();
    this.leftMonth = this.buildMonth(y, m);
    const r = this.addMonths(this.viewAnchor, 1);
    this.rightMonth = this.buildMonth(r.getFullYear(), r.getMonth());
  }

  private addMonths(d: Date, n: number): Date {
    return new Date(d.getFullYear(), d.getMonth() + n, 1);
  }

  private monthYearLabel(d: Date): string {
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(d);
  }

  private toDateKey(d: Date): string {
    const y = d.getFullYear();
    const mo = d.getMonth() + 1;
    const day = d.getDate();
    return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private buildMonth(year: number, monthIndex: number): MonthView {
    const first = new Date(year, monthIndex, 1);
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const cells: CalendarCell[] = [];
    const prevLast = new Date(year, monthIndex, 0).getDate();
    for (let i = 0; i < startPad; i++) {
      const day = prevLast - startPad + i + 1;
      const dt = new Date(year, monthIndex - 1, day);
      cells.push(this.makeCell(dt, false));
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, monthIndex, d);
      cells.push(this.makeCell(dt, true));
    }
    let i = 0;
    while (cells.length % 7 !== 0) {
      i += 1;
      const dt = new Date(year, monthIndex + 1, i);
      cells.push(this.makeCell(dt, false));
    }

    const weeks: CalendarCell[][] = [];
    for (let j = 0; j < cells.length; j += 7) {
      weeks.push(cells.slice(j, j + 7));
    }

    return {
      key: `${year}-${monthIndex}`,
      label: this.monthYearLabel(first),
      weeks
    };
  }

  private makeCell(dt: Date, inMonth: boolean): CalendarCell {
    const dateKey = this.toDateKey(dt);
    const events = this.eventsForDateKey(dateKey);
    const t = new Date();
    const isToday =
      dt.getFullYear() === t.getFullYear() &&
      dt.getMonth() === t.getMonth() &&
      dt.getDate() === t.getDate();
    return {
      day: dt.getDate(),
      inMonth,
      isToday,
      dateKey,
      events
    };
  }

  private eventsForDateKey(key: string): CalendarEventItem[] {
    const out: CalendarEventItem[] = [];
    for (const p of this.projects) {
      if (p.startDate === key) {
        out.push({
          trackId: `s-${p.id}-${key}`,
          kind: 'start',
          projectId: p.id,
          projectName: p.name
        });
      }
      if (p.deadline === key) {
        out.push({
          trackId: `d-${p.id}-${key}`,
          kind: 'deadline',
          projectId: p.id,
          projectName: p.name
        });
      }
    }
    return out;
  }
}
