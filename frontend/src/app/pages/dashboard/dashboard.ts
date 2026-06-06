import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserProfile } from '../../services/api';
import { WebsocketService } from '../../services/websocket.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { Notification } from '../../models/notification.model';
import { CollaboratorReportingPage } from './reporting/collaborator-reporting.component';
import { PmReportingPage } from './reporting/pm-reporting.component';
import { AdminReportingPage } from './reporting/admin-reporting.component';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    ToastModule,
    CollaboratorReportingPage,
    PmReportingPage,
    AdminReportingPage
  ],
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
  providers: [MessageService]
})
export class Dashboard implements OnInit {
  user: UserProfile | null = null;
  title = 'Dashboard';

  constructor(
    private readonly router: Router,
    private readonly ws: WebsocketService,
    private readonly messageService: MessageService
  ) {}

  ngOnInit() {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        this.user = JSON.parse(storedUser);
        if (this.user?.role === 'PROJECT_MANAGER') {
          this.title = 'Project Manager Dashboard';
        } else if (this.user?.role === 'COLLABORATOR') {
          this.title = 'Collaborator Dashboard';
        } else if (this.user?.role === 'ADMIN') {
          this.title = 'Admin Dashboard';
        }
      } catch (e) {
        console.error('Failed to parse user data:', e);
        this.router.navigate(['/login']);
      }
    } else {
      this.router.navigate(['/login']);
    }

    // connect websockets once authenticated
    if (this.user) {
      this.ws.connect();
      this.ws.getNotificationStream().subscribe((notif: Notification) => {
        this.messageService.add({
          severity: 'info',
          summary: 'Notification',
          detail: notif.message
        });
      });
    }
  }


}
