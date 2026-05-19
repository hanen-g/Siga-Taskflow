import { ChangeDetectorRef, Component, inject, OnInit, OnDestroy, ElementRef, ViewChild, HostListener } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { ProjectsCalendarDialog } from './projects-calendar-dialog';
import { LayoutService } from './service/layout.service';
import { WebsocketService } from '../services/websocket.service';
import { Notification } from '../models/notification.model';
import { NotificationService } from '../services/notification.service';
import { Subject } from 'rxjs';
import { distinctUntilChanged, filter, takeUntil } from 'rxjs/operators';

@Component({
    selector: 'app-topbar',
    standalone: true,
    imports: [RouterModule, CommonModule, OverlayBadgeModule, ProjectsCalendarDialog],
    templateUrl: './app.topbar.html',
    styles: [`
        .logo-image {
            height: 40px;
            width: auto;
            margin-right: 0.75rem;
            object-fit: contain;
        }

        .notification-container {
            position: relative;
            display: inline-block;
        }

        .notification-button {
            position: relative;
        }

        .notification-button p-overlaybadge {
            display: inline-flex;
            margin-right: 0.35rem;
        }

        @keyframes shake {
            0%, 100% { transform: rotate(0deg) translateX(0); }
            25% { transform: rotate(-15deg) translateX(-2px); }
            50% { transform: rotate(15deg) translateX(2px); }
            75% { transform: rotate(-15deg) translateX(-2px); }
        }

        .notification-button.shake i {
            animation: shake 0.5s ease-in-out;
            transform-origin: top center;
        }

        .notification-panel {
            position: absolute;
            top: calc(100% + 10px);
            right: 0;
            background: var(--surface-ground);
            border: 1px solid var(--surface-border);
            border-radius: 8px;
            width: 350px;
            max-height: 500px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            display: flex;
            flex-direction: column;
            z-index: 1000;
        }

        .notification-panel-header {
            padding: 1rem;
            border-bottom: 1px solid var(--surface-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .notification-panel-header h3 {
            margin: 0;
            font-size: 1rem;
            font-weight: 600;
        }

        .close-btn {
            background: none;
            border: none;
            cursor: pointer;
            padding: 0.25rem;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-color-secondary);
            transition: color 0.2s;
        }

        .close-btn:hover {
            color: var(--text-color);
        }

        .notification-panel-content {
            flex: 1;
            overflow-y: auto;
            min-height: 100px;
        }

        .notification-item {
            padding: 1rem;
            border-bottom: 1px solid var(--surface-border);
            display: flex;
            gap: 0.75rem;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .notification-item:hover {
            background-color: var(--surface-hover);
        }

        .notification-item:last-child {
            border-bottom: none;
        }

        .notification-icon {
            flex-shrink: 0;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: var(--primary-color);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
        }

        .notification-body {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }

        .notification-message {
            margin: 0;
            font-size: 0.95rem;
            font-weight: 500;
            color: var(--text-color);
            line-height: 1.4;
        }

        .notification-meta {
            color: var(--text-color-secondary);
            font-size: 0.8rem;
        }

        .no-notifications {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem 1rem;
            color: var(--text-color-secondary);
            gap: 0.5rem;
        }

        .no-notifications i {
            font-size: 2rem;
        }

        .notification-panel-footer {
            padding: 0.75rem;
            border-top: 1px solid var(--surface-border);
            display: flex;
            justify-content: center;
        }

        .clear-btn {
            background: none;
            border: 1px solid var(--surface-border);
            color: var(--text-color-secondary);
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.2s;
        }

        .clear-btn:hover {
            background-color: var(--surface-hover);
            color: var(--text-color);
        }
    `]
})
export class AppTopbar implements OnInit, OnDestroy {
    items!: MenuItem[];

    layoutService = inject(LayoutService);
    private ws = inject(WebsocketService);
    private notificationService = inject(NotificationService);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private destroy$ = new Subject<void>();
    @ViewChild('topbarMenu') topbarMenu?: ElementRef<HTMLElement>;
    @ViewChild('topbarMenuButton') topbarMenuButton?: ElementRef<HTMLElement>;

    notifications: Notification[] = [];
    unreadCount = 0;
    showNotificationPanel = false;
    showShake = false;
    userName = '';
    projectsCalendarOpen = false;
    mobileTopbarMenuVisible = false;
    isDesktopView = window.innerWidth > 991;

    get showTopbarMenu(): boolean {
        return this.isDesktopView || this.mobileTopbarMenuVisible;
    }

    ngOnInit() {
        // ensure websocket is connected
        this.ws.connect();
        this.loadStoredNotifications();

        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                this.userName = `${parsed.firstName || ''} ${parsed.lastName || ''}`.trim();
            } catch {
                // ignore
            }
        }

        this.ws.getNotificationStream()
            .pipe(takeUntil(this.destroy$))
            .subscribe((notif: Notification) => {
                this.notifications.unshift({ ...notif, read: false });
                this.unreadCount++;
                this.triggerShake();
                this.cdr.detectChanges();
            });

        this.router.events
            .pipe(
                filter((e): e is NavigationEnd => e instanceof NavigationEnd),
                takeUntil(this.destroy$)
            )
            .subscribe(() => this.loadStoredNotifications());

        this.notificationService.refreshNotifications$
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => this.loadStoredNotifications());

        this.ws
            .getConnectionState()
            .pipe(
                filter((c) => c === true),
                distinctUntilChanged(),
                takeUntil(this.destroy$)
            )
            .subscribe(() => this.loadStoredNotifications());
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    toggleDarkMode() {
        this.layoutService.layoutConfig.update((state) => ({
            ...state,
            darkTheme: !state.darkTheme
        }));
    }

    openProjectsCalendar() {
        this.projectsCalendarOpen = true;
    }

    toggleTopbarMenu(event: Event) {
        event.stopPropagation();
        this.mobileTopbarMenuVisible = !this.mobileTopbarMenuVisible;

        if (!this.mobileTopbarMenuVisible) {
            this.showNotificationPanel = false;
        }
    }

    closeTopbarMenu() {
        this.mobileTopbarMenuVisible = false;
        this.showNotificationPanel = false;
    }

    toggleNotifications() {
        this.showNotificationPanel = !this.showNotificationPanel;
        if (this.showNotificationPanel && this.unreadCount > 0) {
            this.notificationService.markAllAsRead()
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: () => {
                        this.notifications = this.notifications.map(notification => ({ ...notification, read: true }));
                        this.unreadCount = 0;
                        this.cdr.detectChanges();
                    },
                    error: (error) => {
                        console.error('Failed to mark notifications as read', error);
                    }
                });
        }
    }

    clearNotifications() {
        this.notificationService.clearMyNotifications()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => {
                    this.notifications = [];
                    this.unreadCount = 0;
                    this.cdr.detectChanges();
                },
                error: (error) => {
                    console.error('Failed to clear notifications', error);
                }
            });
    }

    private triggerShake() {
        this.showShake = true;
        setTimeout(() => {
            this.showShake = false;
        }, 500);
    }

    @HostListener('window:resize')
    onWindowResize() {
        this.isDesktopView = window.innerWidth > 991;

        if (this.isDesktopView) {
            this.closeTopbarMenu();
        }
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: Event) {
        if (this.isDesktopView || !this.mobileTopbarMenuVisible) {
            return;
        }

        const target = event.target as Node | null;
        const clickedInsideMenu = !!target && !!this.topbarMenu?.nativeElement.contains(target);
        const clickedMenuButton = !!target && !!this.topbarMenuButton?.nativeElement.contains(target);

        if (!clickedInsideMenu && !clickedMenuButton) {
            this.closeTopbarMenu();
        }
    }

    onNotificationClick(notification: Notification, event: Event): void {
        event.stopPropagation();
        if (notification.kind !== 'PROJECT_MESSAGE' || notification.projectId == null) {
            return;
        }

        const role = this.readStoredRole();
        const base =
            role === 'ADMIN'
                ? '/dashboard/admin/projects'
                : role === 'CLIENT'
                  ? '/dashboard/client/projects'
                  : null;
        if (!base) {
            return;
        }

        this.showNotificationPanel = false;
        this.closeTopbarMenu();
        void this.router.navigate([`${base}/${notification.projectId}`], {
            queryParams: { tab: 'chat' }
        });
    }

    private readStoredRole(): string | null {
        const userData = localStorage.getItem('user');
        if (!userData) {
            return null;
        }
        try {
            return JSON.parse(userData)?.role ?? null;
        } catch {
            return null;
        }
    }

    private loadStoredNotifications() {
        this.notificationService.getMyNotifications()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (notifications) => {
                    const ephemeral = this.notifications.filter(n => n.id == null);
                    this.notifications = [...ephemeral, ...notifications];
                    this.unreadCount = this.notifications.filter(notification => !notification.read).length;
                    this.cdr.detectChanges();
                },
                error: (error) => {
                    console.error('Failed to load notifications', error);
                }
            });
    }
}
