import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Menu, MenuModule } from 'primeng/menu';

import { Project } from '../../../models/project.model';
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

  `]
})
export class ProjectPanel implements OnInit {
  @Input() project!: Project;
  @Input() detailBase = '';
  /** Show card menu (archive, upload); PM sees this without edit/delete unless also admin. */
  @Input() canManage = true;
  /** Edit / delete project — administrators only when projects are centrally managed. */
  @Input() canEditOrDeleteProject = true;

  @Output() edit = new EventEmitter<Project>();
  @Output() delete = new EventEmitter<{ id: number; nativeEvent: Event }>();
  @Output() archive = new EventEmitter<{ id: number; archived: boolean; nativeEvent: Event }>();

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('menu') menu?: Menu;

  menuItems: MenuItem[] = [];
  bannerColor = '#dbeafe';

  constructor(
    private projectService: ProjectService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const archived = !!this.project.archived;
    this.bannerColor = this.resolveBannerColor();
    if (this.canManage) {
      this.menuItems = [
        {
          label: archived ? 'Unarchive' : 'Archive',
          icon: archived ? 'pi pi-folder-open' : 'pi pi-building-columns',
          command: (event) =>
            this.archive.emit({
              id: this.project.id,
              archived: !archived,
              nativeEvent: event.originalEvent as Event
            })
        },
        ...(this.canEditOrDeleteProject
          ? ([
              {
                label: 'Edit',
                icon: 'pi pi-pencil',
                command: () => this.edit.emit(this.project)
              },
              {
                label: 'Delete',
                icon: 'pi pi-trash',
                command: (event: { originalEvent?: Event }) =>
                  this.delete.emit({
                    id: this.project.id,
                    nativeEvent: event.originalEvent as Event
                  })
              }
            ] as MenuItem[])
          : []),
        {
          label: 'Upload File',
          icon: 'pi pi-upload',
          command: () => this.openFilePicker()
        }
      ];
    } else {
      this.menuItems = [];
    }
  }

  onCardNavigate(event: MouseEvent): void {
    if (!this.detailBase) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    this.router.navigate([this.detailBase, this.project.id]);
  }

  toggleMenu(event: Event): void {
    this.menu?.toggle(event);
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
    if (!this.canManage) {
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

  private resolveBannerColor(): string {
    const palette = ['#fecdd3', '#fde68a', '#bfdbfe', '#c7d2fe', '#bbf7d0', '#fbcfe8', '#fed7aa', '#a7f3d0'];
    const seed = `${this.project.id ?? ''}${this.project.name ?? ''}`;
    const index = Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0) % palette.length;
    return palette[index];
  }
}
