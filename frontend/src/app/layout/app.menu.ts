import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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
    </ul> `,
})
export class AppMenu {
    model: MenuItem[] = [];

    ngOnInit() {
        this.model = [
            {
                label: 'Home',
                items: [{ label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['dashboard/pm'] }]
            },
            {
                label: 'Projects and Tasks',
                items: [{ label: 'Project List', icon: 'pi pi-folder',routerLink: ['/dashboard/pm/projects'] },
                        { label: 'Task List', icon: 'pi pi-fw pi-check-circle', routerLink: ['tasks/list'] }
                    ]
                
            },
        ]    
    }
}
