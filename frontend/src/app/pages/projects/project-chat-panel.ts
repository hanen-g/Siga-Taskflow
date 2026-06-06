import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Subject, takeUntil } from 'rxjs';
import { ProjectChatMessage } from '../../models/project-chat.model';
import { ProjectChatService } from '../../services/project-chat.service';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  standalone: true,
  selector: 'app-project-chat-panel',
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule],
  templateUrl: './project-chat-panel.html',
  styleUrls: ['./project-chat-panel.css']
})
export class ProjectChatPanelComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input({ required: true }) projectId!: number;
  @Input() active = false;

  @ViewChild('messagesContainer') messagesContainer?: ElementRef<HTMLDivElement>;

  messages: ProjectChatMessage[] = [];
  draft = '';
  loading = false;
  sending = false;
  error: string | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly projectChatService: ProjectChatService,
    private readonly websocketService: WebsocketService,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.websocketService.connect();
    this.websocketService
      .subscribeToProjectChat(this.projectId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((message) => {
        this.ngZone.run(() => this.onIncomingMessage(message));
      });
  }

  ngAfterViewInit(): void {
    if (this.active) {
      this.activateChat();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    const activeChange = changes['active'];
    if (activeChange && !activeChange.firstChange && activeChange.currentValue === true) {
      this.activateChat();
      return;
    }
    if (changes['projectId'] && !changes['projectId'].firstChange && this.active) {
      this.loadMessages();
    }
  }

  private activateChat(): void {
    this.loadMessages();
    this.markAsRead();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadMessages(): void {
    if (!this.projectId) {
      return;
    }
    this.loading = true;
    this.error = null;
    this.projectChatService.getMessages(this.projectId).subscribe({
      next: (messages) => {
        this.messages = messages;
        this.loading = false;
        this.cdr.markForCheck();
        this.scrollToBottom();
      },
      error: () => {
        this.loading = false;
        this.error = 'Unable to load messages.';
        this.cdr.markForCheck();
      }
    });
  }

  markAsRead(): void {
    if (!this.projectId) {
      return;
    }
    this.projectChatService.markAsRead(this.projectId).subscribe({
      next: () => {
        this.messages = this.messages.map((message) =>
          message.fromCurrentUser ? message : { ...message, read: true }
        );
        this.cdr.markForCheck();
      }
    });
  }

  send(): void {
    const content = this.draft.trim();
    if (!content || this.sending || !this.projectId) {
      return;
    }
    this.sending = true;
    this.projectChatService.sendMessage(this.projectId, content).subscribe({
      next: (message) => {
        this.appendMessageIfNew(message);
        this.draft = '';
        this.sending = false;
        this.scrollToBottom();
      },
      error: () => {
        this.sending = false;
        this.error = 'Could not send your message. Try again.';
      }
    });
  }

  onEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 'Enter' && !keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      this.send();
    }
  }

  formatTimestamp(value?: string): string {
    if (!value) {
      return '';
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleString();
  }

  private onIncomingMessage(message: ProjectChatMessage): void {
    this.appendMessageIfNew(message);
    if (!message.fromCurrentUser) {
      this.scrollToBottom();
    }
  }

  private appendMessageIfNew(message: ProjectChatMessage): void {
    if (this.messages.some((existing) => existing.id === message.id)) {
      return;
    }
    this.messages = [...this.messages, message];
    this.cdr.markForCheck();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const element = this.messagesContainer?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }
}
