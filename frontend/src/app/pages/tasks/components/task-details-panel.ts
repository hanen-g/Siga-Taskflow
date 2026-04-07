import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AvatarModule } from 'primeng/avatar';
import { ScrollPanel, ScrollPanelModule } from 'primeng/scrollpanel';

import { Task, TaskStatus, Priority } from '../../../models/task.model';
import { Comment } from '../../../models/comment.model';
import { CommentService } from '../../../services/comment.service';
import { WebsocketService } from '../../../services/websocket.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-task-details-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="task-details-panel" *ngIf="task">
  <div class="panel-header">
    <div class="task-title-section">
      <h3 class="task-title">{{ task.title }}</h3>
      <div class="task-badges">
        <span class="status-badge" [ngClass]="getStatusClass(task.status)">
          {{ statusLabel(task.status) }}
        </span>
        <span class="priority-badge" *ngIf="task.priority" [ngClass]="getPriorityClass(task.priority)">
          {{ priorityLabel(task.priority) }}
        </span>
      </div>
    </div>
    <button type="button" class="close-btn" (click)="close.emit()">
      <i class="pi pi-times"></i>
    </button>
  </div>

  <div class="panel-content">
    <div class="task-info-section">
      <div class="info-item">
        <label>Assigned To:</label>
        <span>{{ getAssigneeName() }}</span>
      </div>
      <div class="info-item">
        <label>Project:</label>
        <span>{{ task.projectName }}</span>
      </div>
      <div class="info-item" *ngIf="task.deadline">
        <label>Due Date:</label>
        <span>{{ task.deadline | date:'medium' }}</span>
      </div>
      <div class="info-item">
        <label>Description:</label>
        <div class="description">{{ task.description || 'No description provided.' }}</div>
      </div>
    </div>

    <div class="comments-section">
      <h4>Comments</h4>
      <p-scrollPanel styleClass="comments-scroll" #scrollPanel>
        <div class="comments-list">
          <div class="comment-item" *ngFor="let comment of comments">
            <div class="comment-header">
              <p-avatar [label]="getInitials(comment.userName)" size="normal"></p-avatar>
              <div class="comment-meta">
                <span class="user-name">{{ comment.userName }}</span>
                <span class="comment-time">{{ formatDate(comment.createdAt) }}</span>
              </div>
            </div>
            <div class="comment-content">{{ comment.content }}</div>
          </div>
          <div *ngIf="comments.length === 0" class="no-comments">
            No comments yet.
          </div>
        </div>
      </p-scrollPanel>

      <div class="add-comment-section">
        <div class="comment-input-wrapper">
          <input
            pInputText
            [(ngModel)]="newComment"
            placeholder="Write a comment..."
            (keyup.enter)="sendComment()"
            class="comment-input"
          />
          <button
            pButton
            type="button"
            icon="pi pi-send"
            [disabled]="!newComment.trim() || isSending"
            (click)="sendComment()"
            class="send-btn"
          ></button>
        </div>
      </div>
    </div>
  </div>
</div>
  `,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    AvatarModule,
    ScrollPanelModule
  ],
  styles: [`
    .task-details-panel {
      width: 400px;
      height: 100vh;
      background: white;
      border-left: 1px solid #e9ecef;
      display: flex;
      flex-direction: column;
      position: fixed;
      right: 0;
      top: 0;
      z-index: 1000;
      box-shadow: -2px 0 8px rgba(0,0,0,0.1);
    }

    .panel-header {
      padding: 1rem;
      border-bottom: 1px solid #e9ecef;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .task-title-section {
      flex: 1;
    }

    .task-title {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .task-badges {
      display: flex;
      gap: 0.5rem;
    }

    .status-badge, .priority-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .status-pending { background: #fef3c7; color: #92400e; }
    .status-inprogress { background: #dbeafe; color: #1e40af; }
    .status-completed { background: #d1fae5; color: #065f46; }

    .priority-low { background: #f3f4f6; color: #374151; }
    .priority-medium { background: #fef3c7; color: #92400e; }
    .priority-high { background: #fee2e2; color: #991b1b; }
    .priority-urgent { background: #fef2f2; color: #7f1d1d; }

    .close-btn {
      background: none;
      border: none;
      color: #6b7280;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 4px;
    }

    .close-btn:hover {
      background: #f3f4f6;
    }

    .panel-content {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .task-info-section {
      padding: 1rem;
      border-bottom: 1px solid #e9ecef;
    }

    .info-item {
      margin-bottom: 0.75rem;
    }

    .info-item:last-child {
      margin-bottom: 0;
    }

    .info-item label {
      display: block;
      font-weight: 500;
      color: #374151;
      margin-bottom: 0.25rem;
    }

    .description {
      color: #6b7280;
      line-height: 1.5;
    }

    .comments-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 1rem;
    }

    .comments-section h4 {
      margin: 0 0 1rem 0;
      font-size: 1rem;
      font-weight: 600;
    }

    .comments-scroll {
      flex: 1;
      margin-bottom: 1rem;
    }

    .comments-scroll .p-scrollpanel-content {
      padding: 0;
    }

    .comments-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .comment-item {
      padding: 0.75rem;
      background: #f9fafb;
      border-radius: 8px;
    }

    .comment-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .comment-meta {
      display: flex;
      flex-direction: column;
    }

    .user-name {
      font-weight: 500;
      font-size: 0.875rem;
    }

    .comment-time {
      font-size: 0.75rem;
      color: #6b7280;
    }

    .comment-content {
      color: #374151;
      line-height: 1.5;
    }

    .no-comments {
      text-align: center;
      color: #6b7280;
      padding: 2rem;
    }

    .add-comment-section {
      border-top: 1px solid #e9ecef;
      padding-top: 1rem;
    }

    .comment-input-wrapper {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .comment-input {
      flex: 1;
    }

    .send-btn {
      padding: 0.5rem;
    }
  `]
})
export class TaskDetailsPanelComponent implements OnInit, OnChanges, OnDestroy {
  @Input() task: Task | null = null;
  @Output() close = new EventEmitter<void>();

@ViewChild('scrollPanel') scrollPanel!: ScrollPanel;

  comments: Comment[] = [];
  newComment = '';
  isSending = false;

  private commentSubscription: Subscription | null = null;
  private subscriptions: Subscription[] = [];

  constructor(
    private commentService: CommentService,
    private ws: WebsocketService,
    private userService: UserService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.commentSubscription) {
      this.commentSubscription.unsubscribe();
    }
  }

  ngOnChanges() {
    if (this.task) {
      // Unsubscribe existing comment subscription before subscribing to new one
      if (this.commentSubscription) {
        this.commentSubscription.unsubscribe();
        this.commentSubscription = null;
      }
      this.loadComments();
      this.subscribeToComments();
    } else {
      // If no task, unsubscribe
      if (this.commentSubscription) {
        this.commentSubscription.unsubscribe();
        this.commentSubscription = null;
      }
    }
  }

  loadComments() {
    if (!this.task?.id) return;

    this.commentService.getCommentsByTask(this.task.id).subscribe({
      next: (comments) => {
        this.comments = comments;
        this.cdr.detectChanges();
        this.scrollToBottom();
      },
      error: (err) => console.error('Failed to load comments', err)
    });
  }

  subscribeToComments() {
    if (!this.task?.id) return;

    this.commentSubscription = this.ws.subscribeToTaskComments(this.task.id).subscribe({
      next: (comment: Comment) => {
        this.comments.push(comment);
        this.cdr.detectChanges();
        this.scrollToBottom();
      }
    });
  }

  sendComment() {
    if (!this.newComment.trim() || !this.task?.id || this.isSending) return;

    this.isSending = true;
    this.commentService.addComment({
      content: this.newComment.trim(),
      taskId: this.task.id
    }).subscribe({
      next: () => {
        this.newComment = '';
        this.isSending = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to send comment', err);
        this.isSending = false;
        this.cdr.detectChanges();
      }
    });
  }

  getAssigneeName(): string {
    if (!this.task?.collaboratorEmails?.length) return 'Unassigned';
    return this.task.collaboratorEmails.join(', ');
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return `Today at ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    } else if (days === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    } else {
      return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
  }

  statusLabel(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.TODO: return 'Pending';
      case TaskStatus.IN_PROGRESS: return 'In Progress';
      case TaskStatus.DONE: return 'Completed';
      default: return status;
    }
  }

  priorityLabel(priority: Priority): string {
    switch (priority) {
      case Priority.LOW: return 'Low';
      case Priority.MEDIUM: return 'Medium';
      case Priority.HIGH: return 'High';
      case Priority.URGENT: return 'Urgent';
      default: return priority;
    }
  }

  getStatusClass(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.TODO: return 'status-pending';
      case TaskStatus.IN_PROGRESS: return 'status-inprogress';
      case TaskStatus.DONE: return 'status-completed';
      default: return '';
    }
  }

  getPriorityClass(priority: Priority): string {
    switch (priority) {
      case Priority.LOW: return 'priority-low';
      case Priority.MEDIUM: return 'priority-medium';
      case Priority.HIGH: return 'priority-high';
      case Priority.URGENT: return 'priority-urgent';
      default: return '';
    }
  }

private scrollToBottom() {
  setTimeout(() => {
    if (this.scrollPanel) {
      const content = this.scrollPanel.el.nativeElement.querySelector('.p-scrollpanel-content');
      if (content) {
        content.scrollTop = content.scrollHeight;
      }
    }
  }, 100);
}
}