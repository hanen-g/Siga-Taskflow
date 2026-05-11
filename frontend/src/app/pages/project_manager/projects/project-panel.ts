import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Menu, MenuModule } from 'primeng/menu';

import { Project } from '../../../models/project.model';
import { TaskStatus } from '../../../models/task.model';
import { ProjectService } from '../../../services/project.service';

@Component({
  selector: 'app-project-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-panel.html',
  imports: [
    CommonModule,
    ButtonModule,
    MenuModule
  ],
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .project-card {
      display: flex;
      flex-direction: column;
      min-height: 20rem;
      height: 100%;
      overflow: hidden;
      border-radius: 1.5rem;
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
    }

    .project-card--navigable {
      cursor: pointer;
    }

    .project-card--paused {
      background: #f3f4f6;
      border-color: #d1d5db;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
    }

    .project-card--archived {
      border-color: rgba(148, 163, 184, 0.35);
      box-shadow: 0 12px 28px rgba(71, 85, 105, 0.12);
      background: #fbfcfd;
    }

    .project-card--archived .project-title {
      color: #334155;
    }

    .project-card--delivered {
      border-color: rgba(56, 189, 248, 0.28);
      box-shadow: 0 16px 34px rgba(14, 116, 144, 0.1);
      background: #fbfeff;
    }

    .project-card--delivered .project-title {
      color: #155e75;
    }

    .project-delivered-hero {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      pointer-events: none;
    }

    .project-archived-hero {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      pointer-events: none;
    }

    .project-archived-circle {
      width: 4.65rem;
      height: 4.65rem;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid rgba(148, 163, 184, 0.35);
      background: radial-gradient(circle at 30% 25%, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%);
      box-shadow: 0 10px 22px rgba(51, 65, 85, 0.2);
      overflow: hidden;
    }

    .project-archived-hero-img {
      width: 3.55rem;
      height: 3.55rem;
      object-fit: contain;
      display: block;
      pointer-events: none;
    }

    .project-archived-pill {
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      font-weight: 700;
      color: #475569;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(71, 85, 105, 0.2);
      border-radius: 999px;
      padding: 0.24rem 0.62rem;
    }

    .project-delivered-circle {
      width: 4.65rem;
      height: 4.65rem;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid rgba(34, 211, 238, 0.35);
      background: radial-gradient(circle at 30% 25%, #ecfeff 0%, #cffafe 45%, #a5f3fc 100%);
      box-shadow: 0 10px 22px rgba(14, 116, 144, 0.2);
      overflow: hidden;
    }

    .project-delivered-hero-img {
      width: 3.55rem;
      height: 3.55rem;
      object-fit: contain;
      display: block;
      pointer-events: none;
    }

    .project-delivered-pill {
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      font-weight: 700;
      color: #0f766e;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(15, 118, 110, 0.2);
      border-radius: 999px;
      padding: 0.24rem 0.62rem;
    }

    .project-delivered-label {
      margin: 0;
      font-size: 0.76rem;
      color: #0f766e;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
    }

    .project-archived-label {
      margin: 0;
      font-size: 0.76rem;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
    }

    .project-card--paused .project-banner {
      filter: grayscale(1);
      opacity: 0.8;
    }

    .project-card--paused .project-title {
      color: #475569;
    }

    .project-card--paused .project-description,
    .project-card--paused .project-created-at {
      color: #94a3b8;
    }

    .project-banner {
      position: relative;
      min-height: 6.75rem;
      height: 33%;
      padding: 1rem;
    }

    .project-menu-button {
      position: absolute;
      top: 0.9rem;
      right: 0.9rem;
      width: 2.5rem;
      height: 2.5rem;
      border: 0;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.58) !important;
      color: #334155 !important;
      backdrop-filter: blur(10px);
    }

    .project-menu-button:enabled:hover {
      background: rgba(255, 255, 255, 0.78) !important;
    }

    .project-card-body {
      display: flex;
      flex: 1;
      flex-direction: column;
      justify-content: space-between;
      gap: 1.5rem;
      padding: 1.4rem;
    }

    .project-copy {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .project-title {
      margin: 0;
      color: #0f172a;
      font-size: 1.2rem;
      font-weight: 500;
      line-height: 1.3;
    }

    .project-description {
      margin: 0;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .project-created-at {
      margin: 0;
      color: #94a3b8;
      font-size: 0.8rem;
      line-height: 1.4;
    }

    .project-status-column {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      margin: 0;
      font-size: 0.78rem;
      font-weight: 700;
      color: #334155;
    }

    .project-status-code {
      min-width: 1.55rem;
      text-align: center;
      padding: 0.14rem 0.4rem;
      border-radius: 999px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      border: 1px solid transparent;
    }

    .project-status-code--0 {
      background: #ffedd5;
      color: #9a3412;
      border-color: #fdba74;
    }

    .project-status-code--1 {
      background: #fef3c7;
      color: #92400e;
      border-color: #fcd34d;
    }

    .project-status-code--2 {
      background: #dbeafe;
      color: #1d4ed8;
      border-color: #93c5fd;
    }

    .project-status-code--3 {
      background: #e2e8f0;
      color: #475569;
      border-color: #cbd5e1;
    }

    .project-status-code--4 {
      background: #cffafe;
      color: #0f766e;
      border-color: #67e8f9;
    }

    .project-status-code--5 {
      background: #e5e7eb;
      color: #374151;
      border-color: #d1d5db;
    }

    .project-paused-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      margin-top: 0.5rem;
    }

  `]
})
export class ProjectPanel implements OnInit, OnChanges {
  @Input() project!: Project;
  @Input() detailBase = '';

  /** When true, show full lifecycle menu (archived, pause, mark delivered) — administrators only. */
  @Input() adminProjectControls = false;

  /** When true, show “edit” and file upload in the context of a project manager. */
  @Input() managerMenu = false;

  @Output() edit = new EventEmitter<Project>();
  @Output() archive = new EventEmitter<{
    id: number;
    archived: boolean;
    name: string;
    nativeEvent: Event;
  }>();
  @Output() setPaused = new EventEmitter<{ id: number; paused: boolean; name: string; nativeEvent: Event }>();
  @Output() setDelivered = new EventEmitter<{ id: number; delivered: boolean; name: string; nativeEvent: Event }>();

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('menu') menu?: Menu;

  menuItems: MenuItem[] = [];
  bannerColor = '#dbeafe';

  /** Menu icon classes — PNG backgrounds in global `styles.scss` (menu uses `appendTo="body"`). */
  private static readonly MENU_ICON_ARCHIVE = 'project-card-menu-hero-archive';
  private static readonly MENU_ICON_DELIVER = 'project-card-menu-hero-deliver';

  get showMenu(): boolean {
    return (this.adminProjectControls || this.managerMenu) && this.menuItems.length > 0;
  }

  get isPaused(): boolean {
    return !!this.project?.paused;
  }

  get canResumePausedProject(): boolean {
    return this.adminProjectControls && this.isPaused;
  }

  constructor(
    private projectService: ProjectService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.bannerColor = this.resolveBannerColor();
    this.rebuildMenu();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.rebuildMenu();
  }

  private rebuildMenu(): void {
    this.bannerColor = this.resolveBannerColor();
    if (!this.project) {
      this.menuItems = [];
      return;
    }
    const archived = !!this.project.archived;
    const paused = !!this.project.paused;
    const delivered = !!this.project.delivered;
    const readyForDelivery = this.isReadyForDelivery(this.project);

    if (this.adminProjectControls) {
      // When paused, keep actions locked except explicit resume.
      if (paused) {
        this.menuItems = [
          {
            label: 'Resume project',
            icon: 'pi pi-play',
            command: (event) =>
              this.setPaused.emit({
                id: this.project.id,
                paused: false,
                name: this.project.name ?? '',
                nativeEvent: event.originalEvent as Event
              })
          }
        ];
      } else {
        this.menuItems = [
          {
            label: archived ? 'Unarchive' : 'Archive',
            icon: archived ? 'pi pi-folder-open' : ProjectPanel.MENU_ICON_ARCHIVE,
            command: (event) =>
              this.archive.emit({
                id: this.project.id,
                archived: !archived,
                name: this.project.name ?? '',
                nativeEvent: event.originalEvent as Event
              })
          },
          {
            label: 'Pause project',
            icon: 'pi pi-pause',
            command: (event) =>
              this.setPaused.emit({
                id: this.project.id,
                paused: true,
                name: this.project.name ?? '',
                nativeEvent: event.originalEvent as Event
              })
          },
          {
            label: delivered ? 'Reopen (not delivered)' : 'Mark as delivered',
            icon: delivered ? 'pi pi-replay' : ProjectPanel.MENU_ICON_DELIVER,
            disabled: !delivered && !readyForDelivery,
            command: (event) => {
              if (!delivered && !readyForDelivery) {
                return;
              }
              this.setDelivered.emit({
                id: this.project.id,
                delivered: !delivered,
                name: this.project.name ?? '',
                nativeEvent: event.originalEvent as Event
              });
            }
          },
          {
            label: 'Edit',
            icon: 'pi pi-pencil',
            command: () => this.edit.emit(this.project)
          },
          {
            label: 'Upload File',
            icon: 'pi pi-upload',
            command: () => this.openFilePicker()
          }
        ];
      }
    } else if (this.managerMenu) {
      this.menuItems = paused
        ? []
        : [
            {
              label: 'Edit',
              icon: 'pi pi-pencil',
              command: () => this.edit.emit(this.project)
            },
            {
              label: 'Upload File',
              icon: 'pi pi-upload',
              command: () => this.openFilePicker()
            }
          ];
    } else {
      this.menuItems = [];
    }
    this.cdr.markForCheck();
  }

  private isReadyForDelivery(project: Project): boolean {
    if (typeof project.readyForDelivery === 'boolean') {
      return project.readyForDelivery;
    }
    const tasks = project.tasks ?? [];
    return tasks.length > 0 && tasks.every((task) => task.status === TaskStatus.DONE);
  }

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

  toggleMenu(event: Event): void {
    this.menu?.toggle(event);
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

  onMenuShow(): void {
    const container = this.menu?.container as HTMLElement | undefined;
    const target = this.menu?.target as HTMLElement | undefined;
    if (!container || !target) {
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const left = targetRect.right - container.offsetWidth;
    const top = targetRect.bottom;
    container.style.left = `${Math.max(left, 0)}px`;
    container.style.top = `${Math.max(top, 0)}px`;
    container.style.transformOrigin = 'top right';
  }

  openFilePicker(): void {
    if (!this.showMenu) {
      return;
    }
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.projectService.uploadAttachment(this.project.id, file).subscribe((updated: Project) => {
      this.project = updated;
      input.value = '';
      this.cdr.markForCheck();
    });
  }

  get statusCode(): number {
    return this.resolveProjectStatusCode();
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

  private resolveBannerColor(): string {
    switch (this.statusCode) {
      case 0:
        return 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 54%, #ffedd5 100%)';
      case 1:
        return 'linear-gradient(135deg, #fef3c7 0%, #fde68a 55%, #fef9c3 100%)';
      case 2:
        return 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 55%, #e0f2fe 100%)';
      case 3:
        return 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)';
      case 4:
        return 'linear-gradient(135deg, #ecfeff 0%, #cffafe 52%, #e0f2fe 100%)';
      case 5:
        return 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 52%, #f8fafc 100%)';
      default:
        return 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 55%, #e0f2fe 100%)';
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
