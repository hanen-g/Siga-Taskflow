import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize, timeout } from 'rxjs/operators';

import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageModule } from 'primeng/message';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { AvatarModule } from 'primeng/avatar';
import { ToastModule } from 'primeng/toast';
import { TextareaModule } from 'primeng/textarea';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ConfirmationService, MessageService } from 'primeng/api';

import type { AiChatUIMessage, AiChatApiResponse } from '../../../models/ai-chat.model';
import { AiChatService, trimConversationHistory } from '../../../services/ai-chat.service';

const AI_CHAT_HTTP_TIMEOUT_MS = 180_000;

const OFF_TOPIC_REFUSAL =
  "I'm here to help with TaskFlow only. Please ask me something related to the app.";

const OFF_TOPIC_KEYWORD_GROUPS = [
  'weather|forecast|recipe|cooking',
  'joke|jokes|meme|sports?|football|basketball|soccer',
  'politics|election|news|headline',
  'movie|movies|film|song|music|lyrics|poem|poetry|homework',
  'celebrity|gossip|stock market|crypto|bitcoin|ethereum',
  'translate this|write code|python code|javascript code|java code|debug my|leetcode',
];
const OFF_TOPIC_KEYWORDS = new RegExp(`\\b(${OFF_TOPIC_KEYWORD_GROUPS.join('|')})\\b`, 'i');

@Component({
  selector: 'app-admin-ai-assistant',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ChipModule,
    ConfirmDialogModule,
    MessageModule,
    ScrollPanelModule,
    AvatarModule,
    ToastModule,
    TextareaModule,
    ProgressSpinnerModule
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './admin-ai-assistant.html',
  styleUrls: ['./admin-ai-assistant.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminAiAssistantPage implements OnInit, AfterViewChecked, OnDestroy {

  input = '';
  uiMessages: AiChatUIMessage[] = [];
  private seq = 1;
  loading = false;
  welcomeVisible = true;
  lastUserForRetry = '';

  pendingScrollBottom = false;
  private dotsTimer?: ReturnType<typeof setInterval>;

  readonly suggestedStarters = [
    'Which projects are behind schedule?',
    'Who is the most overloaded team member?',
    'Show blocked tasks this month',
    'What is the overall completion rate?'
  ];

  constructor(
    private readonly aiChat: AiChatService,
    private readonly confirm: ConfirmationService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.dotsTimer = setInterval(() => this.cdr.markForCheck(), 350);
    this.aiChat.preloadModel().subscribe({ error: () => undefined });
  }

  ngOnDestroy(): void {
    if (this.dotsTimer) {
      clearInterval(this.dotsTimer);
    }
  }

  ngAfterViewChecked(): void {
    if (this.pendingScrollBottom) {
      this.scrollChatToEnd();
      this.pendingScrollBottom = false;
    }
  }

  newConversation(): void {
    this.confirm.confirm({
      message: 'Clear the current conversation?',
      header: 'New conversation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Yes',
      rejectLabel: 'No',
      accept: () => this.resetSession()
    });
  }

  private resetSession(): void {
    this.uiMessages = [];
    this.input = '';
    this.welcomeVisible = true;
    this.lastUserForRetry = '';
    this.cdr.markForCheck();
  }

  exportChat(): void {
    const lines = this.uiMessages.map((m) => {
      const t = `${m.at.getHours().toString().padStart(2, '0')}:${m.at.getMinutes().toString().padStart(2, '0')}`;
      return `[${t}] ${m.role.toUpperCase()}: ${m.content}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskflow-assistant-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  retryLast(): void {
    if (!this.lastUserForRetry) {
      return;
    }
    this.send(this.lastUserForRetry);
  }

  chipPick(q: string): void {
    this.welcomeVisible = false;
    this.send(q);
  }

  composerKey(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      this.submitInput();
    }
  }

  submitInput(): void {
    const t = this.input.trim();
    if (!t || this.loading) {
      return;
    }
    this.input = '';
    this.welcomeVisible = false;
    this.send(t);
  }

  send(text: string): void {
    this.lastUserForRetry = text;
    const userMsg: AiChatUIMessage = {
      id: this.seq++,
      role: 'user',
      content: text,
      at: new Date()
    };
    this.uiMessages = [...this.uiMessages, userMsg];

    if (isClearlyOffTopic(text)) {
      this.uiMessages = [
        ...this.uiMessages,
        {
          id: this.seq++,
          role: 'assistant',
          content: OFF_TOPIC_REFUSAL,
          at: new Date()
        }
      ];
      this.pendingScrollBottom = true;
      this.cdr.markForCheck();
      return;
    }

    const thinking: AiChatUIMessage = {
      id: this.seq++,
      role: 'assistant',
      content: '',
      at: new Date(),
      isThinking: true
    };
    this.uiMessages = [...this.uiMessages, thinking];
    const priorOnly = this.uiMessages.filter((m) => !m.isThinking);
    const historySlice = trimConversationHistory(
      priorOnly.map((m) => ({ role: m.role, content: m.content }))
    );
    const intent = detectIntent(text);
    this.loading = true;
    this.pendingScrollBottom = true;
    this.cdr.markForCheck();

    this.aiChat
      .chat({ message: text, conversationHistory: historySlice, intent })
      .pipe(
        timeout(AI_CHAT_HTTP_TIMEOUT_MS),
        finalize(() => {
          this.loading = false;
          this.pendingScrollBottom = true;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => {
          this.clearThinkingPlaceholders();
          this.applyAiResponse(res);
        },
        error: (err) => {
          if (err?.name === 'TimeoutError') {
            this.finishWithAssistantFailure(
              'The response is taking too long (over 3 minutes). Make sure Ollama is running, then try again.',
              true,
              true
            );
          } else if (err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 500)) {
            this.finishWithAssistantFailure(
              'The AI assistant is temporarily unavailable. Check that Ollama is running on your machine.',
              true,
              false
            );
          } else {
            this.finishWithAssistantFailure(
              'The AI assistant is temporarily unavailable. Please try again later.',
              true,
              false
            );
          }
        }
      });
  }

  private applyAiResponse(res: AiChatApiResponse): void {
    let msg = (res.assistantMessage || '').trim();
    if (!msg) {
      msg = 'The AI assistant could not produce a reply.';
    }

    const ast: AiChatUIMessage = {
      id: this.seq++,
      role: 'assistant',
      content: msg,
      at: new Date()
    };
    this.uiMessages = [...this.uiMessages, ast];
    this.pendingScrollBottom = true;
    this.cdr.markForCheck();
  }

  private clearThinkingPlaceholders(): void {
    this.uiMessages = this.uiMessages.filter((m) => !m.isThinking);
  }

  private finishWithAssistantFailure(text: string, showRetry: boolean, isTimeout: boolean): void {
    this.clearThinkingPlaceholders();
    const ast: AiChatUIMessage = {
      id: this.seq++,
      role: 'assistant',
      content: text,
      at: new Date(),
      isOllamaError: showRetry || isTimeout,
      isTimeout
    };
    this.uiMessages = [...this.uiMessages, ast];
    this.pendingScrollBottom = true;
    this.cdr.markForCheck();
  }

  private scrollChatToEnd(): void {
    setTimeout(() => {
      const wrap = document.querySelector('.admin-ai-chat-messages .p-scrollpanel-content') as HTMLElement | null;
      if (wrap) {
        wrap.scrollTop = wrap.scrollHeight;
      }
    }, 50);
  }

}

function isClearlyOffTopic(text: string): boolean {
  return OFF_TOPIC_KEYWORDS.test(text.trim());
}

function detectIntent(text: string) {
  const t = text.toLowerCase();
  if (/montre|affiche|liste|filtr|filter|show|list/.test(t) && /projet|tâche|task|project/.test(t)) {
    return 'FILTER' as const;
  }
  if (/\?|combien|how many|which|quelles?|quel|qui|what|pourquoi|why/.test(t)) {
    return 'QUESTION' as const;
  }
  if (/analys|performance|insights|risque|risk|tendance|reco|recommend/.test(t)) {
    return 'ANALYSIS' as const;
  }
  return 'UNKNOWN' as const;
}
