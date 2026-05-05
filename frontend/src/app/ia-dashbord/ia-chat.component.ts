import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from './admin.service';

@Component({
  selector: 'app-ia-chat',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ia-dashboard-container">
      <h2>IA Chat</h2>

      <div class="input-section">
        <textarea 
          [(ngModel)]="prompt" 
          placeholder="Enter your stats or prompt..."
          [disabled]="loading">
        </textarea>
        <br><br>

        <button 
          (click)="analyze()"
          [disabled]="!prompt || loading">
          {{ loading ? 'Analyzing...' : 'Analyze' }}
        </button>
      </div>

      @if (error) {
        <div class="error-message">
          <strong>Error:</strong> {{ error }}
        </div>
      }

      @if (response) {
        <div class="response-section">
          <strong>AI response:</strong><br>
          <p>{{ getResponseText() }}</p>
        </div>
      }

      @if (debugInfo) {
        <div class="debug-info">
          <small>{{ debugInfo }}</small>
        </div>
      }
    </div>
  `,
  styles: [`
    .ia-dashboard-container {
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    
    .input-section {
      margin: 20px 0;
    }
    
    textarea {
      width: 100%;
      min-height: 150px;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-family: Arial, sans-serif;
    }
    
    button {
      background-color: #0d47a1;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    
    button:disabled {
      background-color: #999;
      cursor: not-allowed;
    }
    
    .response-section {
      margin-top: 20px;
      padding: 15px;
      background-color: #f5f5f5;
      border-left: 4px solid #0d47a1;
      border-radius: 4px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    
    .error-message {
      margin-top: 20px;
      padding: 15px;
      background-color: #ffebee;
      border-left: 4px solid #c62828;
      border-radius: 4px;
      color: #c62828;
    }

    .debug-info {
      margin-top: 15px;
      padding: 10px;
      background-color: #f0f0f0;
      border: 1px solid #ccc;
      border-radius: 4px;
      color: #666;
    }
  `]
})
export class IAChatComponent {

  prompt = '';
  response: any;
  error: string = '';
  loading = false;
  debugInfo: string = '';

  constructor(private adminService: AdminService) {}

  getResponseText(): string {
    if (!this.response) return '';
    
    if (typeof this.response === 'object') {
      if (this.response.response) return this.response.response;
      if (this.response.data) return this.response.data;
      if (this.response.message) return this.response.message;
      if (this.response.result) return this.response.result;
      if (this.response.analysis) return this.response.analysis;
      return JSON.stringify(this.response, null, 2);
    }
    
    return this.response.toString();
  }

  analyze() {
    if (!this.prompt.trim()) {
      this.error = 'Please enter a prompt';
      this.debugInfo = '';
      return;
    }

    this.loading = true;
    this.error = '';
    this.response = null;
    this.debugInfo = '';

    console.log('Sending request with:', this.prompt);

    this.adminService.analyze(this.prompt)
      .subscribe({
        next: (res) => {
          console.log('Response received:', res);
          this.response = res;
          this.loading = false;
          this.debugInfo = `Type: ${typeof res}, Keys: ${Object.keys(res).join(', ')}`;
        },
        error: (err) => {
          console.error('Error while analyzing:', err);
          
          if (err.status === 0) {
            this.error = 'Could not reach the server (check that the backend is running)';
          } else if (err.error?.message) {
            this.error = err.error.message;
          } else if (err.message) {
            this.error = err.message;
          } else {
            this.error = `HTTP error ${err.status}: ${err.statusText || 'Server error'}`;
          }
          
          this.debugInfo = `Full error: ${JSON.stringify(err)}`;
          this.loading = false;
        }
      });
  }
}
