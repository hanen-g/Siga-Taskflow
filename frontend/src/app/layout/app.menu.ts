import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router,RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        @for (item of model; track item.label) {
            @if (!item.separator) {
                <li app-menuitem [item]="item" [root]="true"></li>
            } @else {
                <li class="menu-separator"></li>
            }
        }
    </ul>
    `
})
export class AppMenu {
    model: MenuItem[] = [];
    constructor(private router: Router) {}
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
                    {
                        label: 'Dashboard',
                        icon: 'pi pi-fw pi-home',
                        routerLink: ['/dashboard/pm']
                    }
                ]
            },
            {
                label: 'Projects',
                items: [
                    {
                        label: 'Project List',
                        icon: 'pi pi-folder',
                        routerLink: ['/dashboard/pm/projects']
                    }
                ]
            }
        ];
    }

    if (role === 'COLLABORATOR') {
        this.model = [
            {
                label: 'Home',
                items: [
                    {
                        label: 'Dashboard',
                        icon: 'pi pi-fw pi-home',
                        routerLink: ['/dashboard/collab']
                    }
                ]
            },
            {
                label: 'Tasks',
                items: [
                    {
                        label: 'My Tasks',
                        icon: 'pi pi-check-square',
                        routerLink: ['/dashboard/collab']
                    }
                ]
            }
        ];
    }

   

    this.model.push({
        items: [
            {
                label: 'Logout',
                icon: 'pi pi-sign-out',
                command: () => this.logout(),
                style: { 'color': '#ef4444' }            }
        ]
    });
}
}