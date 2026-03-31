import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { ApiService, UserProfile } from '../../services/api';
import { WebsocketService } from '../../services/websocket.service';
import { MessageService } from 'primeng/api';
import { Notification } from '../../models/notification.model';

@Component({
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  providers: [MessageService]
})
export class Dashboard implements OnInit {
  user: UserProfile | null = null;
  title = 'Dashboard';

  constructor(
    private api: ApiService,
    private router: Router,
    private ws: WebsocketService,
    private messageService: MessageService
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
