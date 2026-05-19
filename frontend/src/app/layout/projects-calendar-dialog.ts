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
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ProjectService } from '../services/project.service';
import { TaskService } from '../services/task.service';
import { Task } from '../models/task.model';

export type CalendarEventKind = 'start' | 'deadline' | 'task_deadline';

export interface CalendarEventItem {
  trackId: string;
  kind: CalendarEventKind;
  projectId: number;
  headline: string;
  subline?: string;
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
  private taskService = inject(TaskService);
  private cdr = inject(ChangeDetectorRef);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  loading = false;
  loadError: string | null = null;
  projects: Array<{ id: number; name: string; startDate?: string; deadline?: string }> = [];
  tasks: Task[] = [];

  viewAnchor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  leftMonth: MonthView = { key: '', label: '', weeks: [] };
  rightMonth: MonthView = { key: '', label: '', weeks: [] };

  readonly weekDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  get calendarMonths(): MonthView[] {
    return [this.leftMonth, this.rightMonth];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.loadCalendarData();
    }
  }

  eventKindLabel(ev: CalendarEventItem): string {
    switch (ev.kind) {
      case 'start':
        return 'Start';
      case 'deadline':
        return 'Due';
      case 'task_deadline':
        return 'Task';
      default:
        return '';
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

  get hasCalendarDates(): boolean {
    const proj = this.projects.some((p) => !!p.startDate || !!p.deadline);
    const taskDates = this.tasks.some((t) => this.taskDeadlineDateKey(t) != null && t.projectId != null);
    return proj || taskDates;
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

  private loadCalendarData(): void {
    this.loading = true;
    this.loadError = null;
    this.cdr.markForCheck();

    forkJoin({
      projects: this.projectService.myProjects(),
      tasks: this.tasksForRole$().pipe(catchError(() => of<Task[]>([])))
    }).subscribe({
      next: ({ projects, tasks }) => {
        this.projects = Array.isArray(projects) ? projects : [];
        this.tasks = Array.isArray(tasks) ? tasks : [];
        this.loading = false;
        this.rebuildCalendars();
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.loadError = 'Could not load the calendar. Please try again later.';
        this.cdr.markForCheck();
      }
    });
  }

  /** Tasks on the calendar; server returns the appropriate list by role (clients: []). */
  private tasksForRole$() {
    return this.taskService.getTasksForCurrentUser();
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
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);
  }

  private toDateKey(d: Date): string {
    const y = d.getFullYear();
    const mo = d.getMonth() + 1;
    const day = d.getDate();
    return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /**
   * Calendar day key yyyy-MM-dd for a task deadline. Handles ISO strings (any offset), datetime-local echoes,
   * Jackson numeric timestamps, or legacy `[y, mo, day, …]` tuples so events match grid cells reliably.
   */
  private taskDeadlineDateKey(task: Task): string | null {
    return this.normalizeDeadlineToCalendarKey(task.deadline as unknown);
  }

  private normalizeDeadlineToCalendarKey(raw: unknown): string | null {
    if (raw == null || raw === '') return null;

    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      const head = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (head) {
        const y = head[1];
        const mo = head[2];
        const day = head[3];
        return `${y}-${mo}-${day}`;
      }
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) return this.toDateKey(new Date(parsed));
      return null;
    }

    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return this.toDateKey(d);
      return null;
    }

    if (Array.isArray(raw) && raw.length >= 3) {
      const y = Number(raw[0]);
      const moIndex = Number(raw[1]);
      const day = Number(raw[2]);
      if (Number.isNaN(y) || Number.isNaN(moIndex) || Number.isNaN(day)) return null;
      const monthJs = moIndex >= 1 && moIndex <= 12 ? moIndex - 1 : NaN;
      if (Number.isNaN(monthJs)) return null;
      return this.toDateKey(new Date(y, monthJs, day));
    }

    return null;
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
          trackId: `ps-${p.id}-${key}`,
          kind: 'start',
          projectId: p.id,
          headline: p.name
        });
      }
      if (p.deadline === key) {
        out.push({
          trackId: `pd-${p.id}-${key}`,
          kind: 'deadline',
          projectId: p.id,
          headline: p.name
        });
      }
    }

    for (const t of this.tasks) {
      const dk = this.taskDeadlineDateKey(t);
      if (!t?.id || t.projectId == null || dk == null || dk !== key) {
        continue;
      }
      out.push({
        trackId: `t-${t.id}-${key}`,
        kind: 'task_deadline',
        projectId: t.projectId,
        headline: t.title,
        subline: t.projectName
      });
    }

    out.sort((a, b) => {
      const order = { start: 0, deadline: 1, task_deadline: 2 } as const;
      return order[a.kind] - order[b.kind] || a.headline.localeCompare(b.headline, 'en');
    });

    return out;
  }
}
