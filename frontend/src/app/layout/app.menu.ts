import { Component, OnInit } from '@angular/core';
import { ApiService } from '../services/api';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { WebsocketService } from '../services/websocket.service';
import { MenuItem } from 'primeng/api';
import { RippleModule } from 'primeng/ripple';
import { AppMenuitem } from './app.menuitem';

/** Sidebar entries may use `iconImg` (PNG/SVG) instead of PrimeIcons `icon`. */
export type AppMenuItem = MenuItem & { iconImg?: string };

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule, RippleModule],
    template: `<div class="layout-menu-container">
  <ul class="layout-menu layout-menu-main">
    @for (item of model; track item.label) {
      @if (!item.separator) {
        <li app-menuitem [item]="item" [root]="true"></li>
      } @else {
        <li class="menu-separator"></li>
      }
    }
  </ul>
  <div class="layout-menu-footer">
    <a
      class="layout-menu-logout"
      href="#"
      role="button"
      tabindex="0"
      (click)="onLogoutClick($event)"
      pRipple>
      <i class="pi pi-sign-out layout-menuitem-icon"></i>
      <span class="layout-menuitem-text">Logout</span>
    </a>
  </div>
</div>`
})
export class AppMenu implements OnInit {
    model: AppMenuItem[] = [];

    constructor(
        private readonly router: Router,
        private readonly ws: WebsocketService,
        private readonly api: ApiService
    ) {}

    onLogoutClick(event: Event) {
        event.preventDefault();
        this.logout();
    }

    logout() {
        this.ws.disconnect();
        localStorage.clear();
        this.router.navigate(['/login']);
    }

    ngOnInit() {
        const role = this.api.getResolvedRole();

        if (role === 'PROJECT_MANAGER') {
            this.model = [
                {
                    label: 'Home',
                    items: [
                        { label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/dashboard/pm'] }
                    ]
                },
                {
                    label: 'Projects',
                    items: [
                        { label: 'Project List', icon: 'pi pi-folder', routerLink: ['/dashboard/pm/projects'] }
                    ]
                },
                {
                    label: 'Tasks',
                    items: [
                        { label: 'Tasks List', icon: 'pi pi-check-square', routerLink: ['/dashboard/pm/tasks'] },
                        { label: 'Task Reports', icon: 'pi pi-flag', routerLink: ['/dashboard/pm/task-reports'] }
                    ]
                }
            ];
        }

        if (role === 'COLLABORATOR') {
            this.model = [
                {
                    label: 'Home',
                    items: [
                        { label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/dashboard/collab'] }
                    ]
                },
                {
                    label: 'Projects',
                    items: [
                        { label: 'Project List', icon: 'pi pi-folder', routerLink: ['/dashboard/collab/projects'] }
                    ]
                },
                {
                    label: 'Tasks',
                    items: [
                        { label: 'My Tasks', icon: 'pi pi-check-square', routerLink: ['/dashboard/collab/tasks'] }
                    ]
                }
            ];
        }

        if (role === 'CLIENT') {
            this.model = [
                {
                    label: 'Home',
                    items: [
                        { label: 'My projects', icon: 'pi pi-folder', routerLink: ['/dashboard/client'] }
                    ]
                }
            ];
        }

        if (role === 'ADMIN') {
            this.model = [
                {
                    label: 'Home',
                    items: [{ label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/dashboard/admin'] }]
                },
                {
                    label: 'Projects & Tasks',
                    path: '/projects-and-tasks',
                    items: [
                        {
                            label: 'All Projects',
                            icon: 'pi pi-folder',
                            path: '/all-projects',
                            command: () => {
                                this.router.navigate(['/dashboard/admin/projects'], {
                                    queryParams: {},
                                });
                            },
                            items: [
                                {
                                    label: 'In Progress projects',
                                    icon: 'pi pi-list',
                                    routerLink: ['/dashboard/admin/projects'],
                                    queryParams: { filter: 'in-progress' },
                                },
                                {
                                    label: 'Not started projects',
                                    icon: 'pi pi-calendar',
                                    routerLink: ['/dashboard/admin/projects'],
                                    queryParams: { filter: 'not-started' },
                                },
                                {
                                    label: 'Paused projects',
                                    icon: 'pi pi-pause',
                                    routerLink: ['/dashboard/admin/projects'],
                                    queryParams: { filter: 'paused' },
                                },
                                {
                                    label: 'Archived projects',
                                    icon: 'pi pi-trash',
                                    routerLink: ['/dashboard/admin/archives']
                                },
                                {
                                    label: 'Delivered projects',
                                    icon: 'pi pi-truck',
                                    routerLink: ['/dashboard/admin/delivered']
                                },
                                {
                                    label: 'Proposed project ideas',
                                    icon: 'pi pi-lightbulb',
                                    routerLink: ['/dashboard/admin/project-proposals']
                                },
                            ]
                        }
                    ]
                },
                {
                    label: 'Users',
                    path: '/users',
                    command: ({ originalEvent }) => {
                        originalEvent?.preventDefault();
                        this.router.navigate(['/dashboard/admin/users']);
                    },
                    items: [
                        { label: 'Create users', icon: 'pi pi-user-plus', routerLink: ['/dashboard/admin/create-users'] },
                        {
                            label: 'Users',
                            icon: 'pi pi-users',
                            path: '/users-by-role',
                            command: ({ originalEvent }) => {
                                originalEvent?.preventDefault();
                                this.router.navigate(['/dashboard/admin/users']);
                            },
                            items: [
                                { label: 'Admins', icon: 'pi pi-shield', routerLink: ['/dashboard/admin/users'], queryParams: { role: 'ADMIN' } },
                                { label: 'Collaborators', icon: 'pi pi-users', routerLink: ['/dashboard/admin/users'], queryParams: { role: 'COLLABORATOR' } },
                                { label: 'Project managers', icon: 'pi pi-briefcase', routerLink: ['/dashboard/admin/users'], queryParams: { role: 'PROJECT_MANAGER' } }
                            ]
                        }
                    ]
                },
                {
                    label: 'Skills',
                    items: [
                        { label: 'Skills', icon: 'pi pi-cog', routerLink: ['/dashboard/admin/skills'] }
                    ]
                },
                {
                    label: 'Clients',
                    items: [
                        { label: 'Clients', icon: 'pi pi-face-smile', routerLink: ['/dashboard/admin/create-client'] }
                    ]
                },
                {
                    label: 'Data Reporting Tools',
                    items: [
                        {
                            label: 'Advanced filtering',
                            icon: 'pi pi-filter',
                            routerLink: ['/dashboard/admin/advanced-filter']
                        },
                        {
                            label: 'AI Assistant',
                            icon: 'pi pi-microchip-ai',
                            routerLink: ['/dashboard/admin/ai-chat']
                        }
                    ]
                },
            ];
        }

    }
}
