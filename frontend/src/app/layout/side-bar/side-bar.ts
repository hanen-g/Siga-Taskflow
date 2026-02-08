import { Component, Input } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { AvatarModule } from 'primeng/avatar';

@Component({
  selector: 'app-side-bar',
  standalone: true,
  imports: [AvatarModule, ButtonModule, DrawerModule, RippleModule],
  templateUrl: './side-bar.html',
  styleUrls: ['./side-bar.css']
})
export class Sidebar {
  visible = false;

  @Input() title = 'Menu';
  @Input() links: { label: string; route: string }[] = [];
}