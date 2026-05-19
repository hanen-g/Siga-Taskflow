import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';

import { Project } from '../../models/project.model';
import { TaskStatus } from '../../models/task.model';

@Component({
  selector: 'app-project-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-panel.html',
  styleUrl: './project-panel.css',
  imports: [CommonModule, ButtonModule]
})
export class ProjectPanel {
  @Input() project!: Project;
  @Input() detailBase = '';

  /**
   * When true, archived/delivered hero PNGs replace the default project icon
   * (used on dedicated archived & delivered list pages only).
   */
  @Input() lifecycleHeroIcon = false;

  /** When true, show admin-only controls (accent circle, unpause button). */
  @Input() adminProjectControls = false;

  /**
   * When true, show the top-right accent circle (uses {@link #clientColor} or the project's client label color).
   * Defaults to the same behavior as {@link #adminProjectControls} when not set explicitly.
   */
  @Input() isAdmin: boolean | null = null;

  /** Optional override for accent circle fill (hex). When omitted, uses `project.clientLabelColor` from API. */
  @Input() clientColor: string | null | undefined;

  /** Optional card title; defaults to `project.name`. */
  @Input() title?: string;

  /** Optional description; defaults to `project.description`. */
  @Input() description?: string;

  @Output() edit = new EventEmitter<Project>();
  @Output() archive = new EventEmitter<{
    id: number;
    archived: boolean;
    name: string;
    nativeEvent: Event;
  }>();
  @Output() setPaused = new EventEmitter<{ id: number; paused: boolean; name: string; nativeEvent: Event }>();
  @Output() setDelivered = new EventEmitter<{ id: number; delivered: boolean; name: string; nativeEvent: Event }>();

  get isPaused(): boolean {
    return !!this.project?.paused;
  }

  get canResumePausedProject(): boolean {
    return this.adminProjectControls && this.isPaused;
  }

  constructor(private router: Router) {}

  onCardNavigate(event: MouseEvent): void {
    if (!this.detailBase || this.project?.id == null) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    const base = this.detailBase.replace(/\/$/, '');
    void this.router.navigateByUrl(`${base}/${this.project.id}`);
  }

  resumePausedProject(event: Event): void {
    event.stopPropagation();
    this.setPaused.emit({
      id: this.project.id,
      paused: false,
      name: this.project.name ?? '',
      nativeEvent: event
    });
  }

  get statusCode(): number {
    return this.resolveProjectStatusCode();
  }

  get showAdminAccent(): boolean {
    if (this.isAdmin === true) {
      return true;
    }
    if (this.isAdmin === false) {
      return false;
    }
    return this.adminProjectControls;
  }

  get accentCircleColor(): string | null {
    const raw = (this.clientColor ?? this.project?.clientLabelColor ?? '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
      return raw;
    }
    return null;
  }

  get displayTitle(): string {
    const t = (this.title ?? this.project?.name ?? '').trim();
    return t || 'Untitled project';
  }

  get displayDescription(): string {
    const d = (this.description ?? this.project?.description ?? '').trim();
    return d || 'No description yet for this project.';
  }

  statusCodeLabel(): string {
    switch (this.statusCode) {
      case 0:
        return 'Proposed';
      case 1:
        return 'Not started';
      case 2:
        return 'In progress';
      case 3:
        return 'Archived';
      case 4:
        return 'Delivered';
      case 5:
        return 'Paused';
      default:
        return 'In progress';
    }
  }

  private resolveProjectStatusCode(): number {
    const fromApi = Number(this.project?.projectStatus);
    if (Number.isInteger(fromApi) && fromApi >= 0) {
      return fromApi;
    }
    if (this.project?.archived) {
      return 3;
    }
    if (this.project?.delivered) {
      return 4;
    }
    if (this.project?.paused) {
      return 5;
    }
    if (this.isNotStartedByDate(this.project?.startDate)) {
      return 1;
    }
    return 2;
  }

  private isNotStartedByDate(raw?: string): boolean {
    if (!raw || typeof raw !== 'string') {
      return false;
    }
    const ymd = raw.length >= 10 ? raw.slice(0, 10) : raw;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      return false;
    }
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return ymd > today;
  }
}
