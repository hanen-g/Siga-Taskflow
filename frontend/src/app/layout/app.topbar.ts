import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { StyleClassModule } from 'primeng/styleclass';
import { LayoutService } from './service/layout.service';
import { WebsocketService } from '../services/websocket.service';
import { Notification } from '../models/notification.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
    selector: 'app-topbar',
    standalone: true,
    imports: [RouterModule, CommonModule, StyleClassModule],
    template: ` <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
            <button class="layout-menu-button layout-topbar-action" (click)="layoutService.onMenuToggle()">
                <i class="pi pi-bars"></i>
            </button>
                <span class="layout-topbar-logo">TASKFLOW</span>
        </div>

        <div class="layout-topbar-actions">
            <div class="layout-config-menu">
                <button type="button" class="layout-topbar-action" (click)="toggleDarkMode()">
                    <i [ngClass]="{ 'pi ': true, 'pi-moon': layoutService.isDarkTheme(), 'pi-sun': !layoutService.isDarkTheme() }"></i>
                </button>
                
            </div>

            <button class="layout-topbar-menu-button layout-topbar-action" pStyleClass="@next" enterFromClass="hidden" enterActiveClass="animate-scalein" leaveToClass="hidden" leaveActiveClass="animate-fadeout" [hideOnOutsideClick]="true">
                <i class="pi pi-ellipsis-v"></i>
            </button>

            <div class="layout-topbar-menu hidden lg:block">
                <div class="layout-topbar-menu-content">
                    <div class="notification-container">
                        <button 
                            type="button" 
                            class="layout-topbar-action notification-button"
                            [class.has-notifications]="unreadCount > 0"
                            [class.shake]="showShake"
                            (click)="toggleNotifications()">
                            <i class="pi pi-bell"></i>
                            <span>Notifications</span>
                            <span *ngIf="unreadCount > 0" class="notification-badge">{{ unreadCount }}</span>
                        </button>
                        
                        <!-- Notification Panel -->
                        <div *ngIf="showNotificationPanel" class="notification-panel">
                            <div class="notification-panel-header">
                                <h3>Notifications</h3>
                                <button type="button" class="close-btn" (click)="toggleNotifications()">
                                    <i class="pi pi-times"></i>
                                </button>
                            </div>
                            <div class="notification-panel-content">
                                @if (notifications.length > 0) {
                                    <div *ngFor="let notif of notifications" class="notification-item">
                                        <div class="notification-icon">
                                            <i class="pi pi-info-circle"></i>
                                        </div>
                                        <div class="notification-body">
                                            <p class="notification-message">{{ notif.message }}</p>
                                            @if (notif.projectName) {
                                                <small class="notification-meta">Project: {{ notif.projectName }}</small>
                                            }
                                            @if (notif.taskTitle) {
                                                <small class="notification-meta">Task: {{ notif.taskTitle }}</small>
                                            }
                                        </div>
                                    </div>
                                } @else {
                                    <div class="no-notifications">
                                        <i class="pi pi-inbox"></i>
                                        <p>No notifications</p>
                                    </div>
                                }
                            </div>
                            @if (notifications.length > 0) {
                                <div class="notification-panel-footer">
                                    <button type="button" class="clear-btn" (click)="clearNotifications()">
                                        Clear all
                                    </button>
                                </div>
                            }
                        </div>
                    </div>
                    <button type="button" class="layout-topbar-action" [routerLink]="['/dashboard/profile']">
                        <i class="pi pi-user"></i>
                        <span>{{ userName || 'Profile' }}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>`,
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

        .notification-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            background-color: #ef4444;
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.7rem;
            font-weight: bold;
            border: 2px solid white;
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
    private destroy$ = new Subject<void>();

    notifications: Notification[] = [];
    unreadCount = 0;
    showNotificationPanel = false;
    showShake = false;
    userName = '';

    ngOnInit() {
        // ensure websocket is connected
        this.ws.connect();

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
                this.notifications.unshift(notif);
                this.unreadCount++;
                this.triggerShake();
            });
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

    toggleNotifications() {
        this.showNotificationPanel = !this.showNotificationPanel;
        if (this.showNotificationPanel) {
            this.unreadCount = 0;
        }
    }

    clearNotifications() {
        this.notifications = [];
        this.unreadCount = 0;
    }

    private triggerShake() {
        this.showShake = true;
        setTimeout(() => {
            this.showShake = false;
        }, 500);
    }
}