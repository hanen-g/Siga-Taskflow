import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BrowserHistoryAuthService } from './services/browser-history-auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  standalone: true,
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = signal('TaskFlow');

  constructor() {
    inject(BrowserHistoryAuthService);
  }
}
