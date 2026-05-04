import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { WebsocketService } from '../services/websocket.service';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';

/** Sidebar entries may use `iconImg` (PNG/SVG) instead of PrimeIcons `icon`. */
export type AppMenuItem = MenuItem & { iconImg?: string };

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template:`<ul class="layout-menu">
  @for (item of model; track item.label) {
    @if (!item.separator) {
      <li app-menuitem [item]="item" [root]="true"></li>
    } @else {
      <li class="menu-separator"></li>
    }
  }
</ul>
`})
export class AppMenu {
    model: AppMenuItem[] = [];

    constructor(private router: Router, private ws: WebsocketService) {}

    private getRoleFromToken(): string | null {
        const token = localStorage.getItem('token');
        if (!token) return null;

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.role;
        } catch {
            return null;
        }
    }

    logout() {
        this.ws.disconnect();
        localStorage.clear();
        this.router.navigate(['/login']);
    }

    ngOnInit() {
        const role = this.getRoleFromToken();

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
                },
                {
                    label: 'Tools',
                    items: [
                        { label: 'IA Chat', icon: 'pi pi-comments', routerLink: ['/dashboard/pm/ia-chat'] }
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
                },
                {
                    label: 'Tools',
                    items: [
                        { label: 'IA Chat', icon: 'pi pi-comments', routerLink: ['/dashboard/collab/ia-chat'] }
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
                },
                {
                    label: 'Account',
                    items: [
                        { label: 'My profile', icon: 'pi pi-user', routerLink: ['/dashboard/profile'] }
                    ]
                }
            ];
        }

        if (role === 'ADMIN') {
            this.model = [
                {
                    label: 'Home',
                    items: [
                        { label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/dashboard/admin'] }
                    ]
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
                                void this.router.navigate(['/dashboard/admin/projects'], {
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
                                    iconImg: 'assets/images/archived-hero.png',
                                    routerLink: ['/dashboard/admin/archives']
                                },
                                {
                                    label: 'Delivered projects',
                                    iconImg: 'assets/images/delivery-hero.png',
                                    routerLink: ['/dashboard/admin/delivered']
                                },
                                {
                                    label: 'Proposed project ideas',
                                    iconImg: 'assets/images/proposed-subjects-icon.png',
                                    routerLink: ['/dashboard/admin/project-proposals']
                                },
                            ]
                        }
                    ]
                },
                {
                    label: 'Users',
                    path: '/users',
                    items: [
                        { label: 'Create users', icon: 'pi pi-user-plus', routerLink: ['/dashboard/admin/create-users'] },
                        {
                            label: 'Users',
                            icon: 'pi pi-users',
                            path: '/users-by-role',
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
                        { label: 'Skills catalog', icon: 'pi pi-list', routerLink: ['/dashboard/admin/skills'] }
                    ]
                },
                {
                    label: 'Clients',
                    items: [
                        { label: 'Create client', icon: 'pi pi-user-plus', routerLink: ['/dashboard/admin/create-client'] }
                    ]
                },
                {
                    label: 'Tools',
                    items: [
                        { label: 'IA Chat', icon: 'pi pi-comments', routerLink: ['/dashboard/admin/ia-chat'] }
                    ]
                }
            ];
        }

        this.model.push({
            items: [
                { label: 'Logout', icon: 'pi pi-sign-out', command: () => this.logout(), style: { 'color': '#e61414' } }
            ]
        });
    }
}
