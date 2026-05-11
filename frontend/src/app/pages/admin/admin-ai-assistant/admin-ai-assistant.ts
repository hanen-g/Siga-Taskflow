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
import { EMPTY, Observable } from 'rxjs';
import { catchError, finalize, timeout } from 'rxjs/operators';

/** Align with backend RestTemplate read timeout (~3 min). */
const AI_CHAT_HTTP_TIMEOUT_MS = 180_000;

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageModule } from 'primeng/message';
import { PanelModule } from 'primeng/panel';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { AvatarModule } from 'primeng/avatar';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TextareaModule } from 'primeng/textarea';
import { ConfirmationService, MessageService } from 'primeng/api';

import type { AiChatFilters, AiChatUIMessage, AiConversationMessage } from '../../../models/ai-chat.model';
import type { AiChatApiResponse } from '../../../models/ai-chat.model';
import { AiChatService } from '../../../services/ai-chat.service';

@Component({
  selector: 'app-admin-ai-assistant',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    ChipModule,
    ConfirmDialogModule,
    MessageModule,
    PanelModule,
    ProgressBarModule,
    SkeletonModule,
    ScrollPanelModule,
    AvatarModule,
    PaginatorModule,
    TagModule,
    ToastModule,
    TextareaModule
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
  suggestionBanner: string | null = null;
  lastUserForRetry = '';

  actionTypeUpper: string | null = null;
  resultsPayload: AiChatApiResponse['results'] = [];
  resultCountTotal = 0;

  resultsPaged: AiChatApiResponse['results'] = [];
  resultsFirst = 0;
  resultsRowsPerPage = 10;

  answerBlock?: { assistantMessage: string; dataSnapshot: string };

  activeFilterChips: { key: string; label: string; valueLabel: string }[] = [];

  pendingScrollBottom = false;
  private dotsTimer?: ReturnType<typeof setInterval>;

  readonly suggestedStarters = [
    'Which projects are behind schedule?',
    'Who is the most overloaded team member?',
    'Show blocked tasks this month',
    'What is the overall completion rate?'
  ];

  constructor(
    private aiChat: AiChatService,
    private confirm: ConfirmationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.dotsTimer = setInterval(() => this.cdr.markForCheck(), 350);
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
    this.suggestionBanner = null;
    this.resultsPayload = [];
    this.resultsPaged = [];
    this.resultCountTotal = 0;
    this.actionTypeUpper = null;
    this.answerBlock = undefined;
    this.activeFilterChips = [];
    this.resultsFirst = 0;
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
    void this.send(this.lastUserForRetry);
  }

  chipPick(q: string): void {
    this.welcomeVisible = false;
    void this.send(q);
  }

  followUpChip(q: string): void {
    if (this.loading) {
      return;
    }
    void this.send(q);
  }

  composerKey(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      void this.submitInput();
    }
  }

  submitInput(): void {
    const t = this.input.trim();
    if (!t || this.loading) {
      return;
    }
    this.input = '';
    this.welcomeVisible = false;
    void this.send(t);
  }

  removeFilterChip(c: { key: string; label: string; valueLabel: string }): void {
    const msg =
      `I removed the filter "${c.label}: ${c.valueLabel}". Refresh the results accordingly.`;
    void this.send(msg);
  }

  paginate(ev: PaginatorState): void {
    this.resultsFirst = ev.first ?? 0;
    this.resultsRowsPerPage = ev.rows ?? 10;
    this.sliceResults();
    this.cdr.markForCheck();
  }

  isProjectRow(r: AiChatApiResponse['results'][0]): boolean {
    return (r?.entityType || 'PROJECT') === 'PROJECT';
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
    const priorOnly = this.uiMessages.slice(0, -1);
    const historySlice = sliceHistory(priorOnly, 20);
    const intent = detectIntent(text);
    this.loading = true;
    this.suggestionBanner = null;
    this.answerBlock = undefined;
    this.pendingScrollBottom = true;
    this.cdr.markForCheck();

    this.aiChat
      .chat({ message: text, conversationHistory: historySlice, intent })
      .pipe(
        timeout(AI_CHAT_HTTP_TIMEOUT_MS),
        catchError((err): Observable<AiChatApiResponse> => {
          if (err?.name === 'TimeoutError') {
            this.finishWithAssistantFailure(
              'The response is taking too long (over 3 minutes). Make sure Ollama is running, then try again — or ask a shorter question.',
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
          return EMPTY;
        }),
        finalize(() => {
          this.loading = false;
          this.pendingScrollBottom = true;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => this.applyAiResponse(res)
      });
  }

  private applyAiResponse(res: AiChatApiResponse): void {
    const action = (res.actionType || '').trim().toUpperCase();
    let msg = (res.assistantMessage || '').trim();
    if (!msg) {
      msg = 'The AI assistant could not produce a reply.';
    }

    const followUps = Array.isArray(res.suggestedFollowUps) ? res.suggestedFollowUps.slice(0, 3) : [];
    const ast: AiChatUIMessage = {
      id: this.seq++,
      role: 'assistant',
      content: msg,
      at: new Date(),
      followUps
    };
    this.uiMessages = [...this.uiMessages, ast];

    this.actionTypeUpper = action || null;
    this.suggestionBanner =
      res.suggestion && res.suggestion !== 'null' && res.suggestion.trim() ? res.suggestion : null;

    if (action === 'FILTER') {
      this.resultsPayload = res.results ?? [];
      this.resultCountTotal = typeof res.resultCount === 'number' ? res.resultCount : this.resultsPayload.length;
      this.buildFilterChips(res.filters);
      this.resultsFirst = 0;
      this.sliceResults();
      this.answerBlock = undefined;
    } else if (action === 'ANSWER' || action === 'ANALYSIS' || action === 'CLARIFY') {
      this.resultsPayload = [];
      this.resultCountTotal = 0;
      this.activeFilterChips = [];
      this.answerBlock = {
        assistantMessage: msg,
        dataSnapshot: res.dataSnapshot ?? ''
      };
    } else {
      this.resultsPayload = [];
      this.resultCountTotal = 0;
      this.activeFilterChips = [];
      this.answerBlock = undefined;
    }

    this.pendingScrollBottom = true;
    this.cdr.markForCheck();
  }

  private finishWithAssistantFailure(text: string, showRetry: boolean, isTimeout: boolean): void {
    const ast: AiChatUIMessage = {
      id: this.seq++,
      role: 'assistant',
      content: text,
      at: new Date(),
      followUps: [],
      isOllamaError: showRetry || isTimeout,
      isTimeout
    };
    this.uiMessages = [...this.uiMessages, ast];
    this.pendingScrollBottom = true;
    this.cdr.markForCheck();
  }

  private sliceResults(): void {
    const start = this.resultsFirst;
    const end = start + this.resultsRowsPerPage;
    this.resultsPaged = this.resultsPayload.slice(start, end);
  }

  private scrollChatToEnd(): void {
    setTimeout(() => {
      const wrap = document.querySelector('.admin-ai-chat-messages .p-scrollpanel-content') as HTMLElement | null;
      if (wrap) {
        wrap.scrollTop = wrap.scrollHeight;
      }
    }, 50);
  }

  private buildFilterChips(filters: AiChatFilters | null | undefined): void {
    if (!filters) {
      this.activeFilterChips = [];
      return;
    }
    const out: { key: string; label: string; valueLabel: string }[] = [];
    const add = (key: string, label: string, value: unknown) => {
      if (value === null || value === undefined) {
        return;
      }
      if (typeof value === 'string' && !value.trim()) {
        return;
      }
      if (Array.isArray(value) && value.length === 0) {
        return;
      }
      if (typeof value === 'boolean' && value === false) {
        return;
      }
      out.push({ key, label, valueLabel: formatFilterValue(value) });
    };
    add('projectName', 'Project', filters.projectName);
    add('projectManagerName', 'PM', filters.projectManagerName);
    add('projectStatus', 'Project status', filters.projectStatus);
    add('startDateFrom', 'Start from', filters.startDateFrom);
    add('startDateTo', 'Start until', filters.startDateTo);
    add('deadlineFrom', 'Deadline from', filters.deadlineFrom);
    add('deadlineTo', 'Deadline until', filters.deadlineTo);
    add('collaboratorName', 'Collaborator', filters.collaboratorName);
    add('taskStatus', 'Task status', filters.taskStatus);
    add('taskPriority', 'Priority', filters.taskPriority);
    if (filters.skills?.length) {
      add('skills', 'Skills', filters.skills.join(', '));
    }
    add('minCompletionRate', 'Min completion %', filters.minCompletionRate);
    add('maxCompletionRate', 'Max completion %', filters.maxCompletionRate);
    if (filters.hasOverdueTasks === true) {
      add('hasOverdueTasks', 'Overdue', true);
    }
    if (filters.hasBlockedTasks === true) {
      add('hasBlockedTasks', 'Blocked', true);
    }
    this.activeFilterChips = out;
  }

  statusSeverity(status: string | undefined): 'success' | 'info' | 'warn' | 'secondary' | 'danger' {
    if (!status) return 'secondary';
    const u = status.toUpperCase();
    if (u === 'COMPLETED') return 'success';
    if (u === 'ACTIVE') return 'info';
    if (u === 'PAUSED' || u === 'ARCHIVED') return 'warn';
    return 'secondary';
  }

  taskSev(status: string | undefined): 'success' | 'info' | 'warn' | 'secondary' {
    if (!status) return 'secondary';
    if (status === 'DONE') return 'success';
    if (status === 'ON_HOLD') return 'warn';
    if (status === 'IN_PROGRESS' || status === 'IN_REVIEW') return 'info';
    return 'secondary';
  }

  assistantHasFollowUps(m: AiChatUIMessage): boolean {
    return Array.isArray(m.followUps) && m.followUps.length > 0;
  }
}

function formatFilterValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}

function sliceHistory(ui: AiChatUIMessage[], max: number): AiConversationMessage[] {
  const all: AiConversationMessage[] = ui.map((m) => ({ role: m.role, content: m.content }));
  if (all.length <= max) {
    return all;
  }
  return all.slice(all.length - max);
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
