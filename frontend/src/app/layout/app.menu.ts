import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { WebsocketService } from '../services/websocket.service';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';

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
    model: MenuItem[] = [];

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
                        { label: 'Project List', icon: 'pi pi-folder', routerLink: ['/dashboard/pm/projects'] },
                        { label: 'Archive', icon: 'pi pi-building-columns', routerLink: ['/dashboard/pm/archives'] }
                    ]
                },
                {
                    label: 'Tasks',
                    items: [
                        { label: 'Tasks List', icon: 'pi pi-check-square', routerLink: ['/dashboard/pm/tasks'] }
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
                    items: [
                        { label: 'All Projects', icon: 'pi pi-folder', routerLink: ['/dashboard/admin/projects'] },
                        { label: 'Proposed project ideas', icon: 'pi pi-lightbulb', routerLink: ['/dashboard/admin/project-proposals'] },
                        { label: 'All Tasks', icon: 'pi pi-check-square', routerLink: ['/dashboard/admin/tasks'] }
                    ]
                },
                {
                    label: 'Users',
                    items: [
                        { label: 'Create users', icon: 'pi pi-user-plus', routerLink: ['/dashboard/admin/create-users'] },
                        { label: 'Users', icon: 'pi pi-users', routerLink: ['/dashboard/admin/users'] }
                    ]
                },
                {
                    label: 'Skills',
                    items: [
                        { label: 'Skills catalog', icon: 'pi pi-list', routerLink: ['/dashboard/admin/skills'] }
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
