export type ChatIntent = 'FILTER' | 'QUESTION' | 'ANALYSIS' | 'UNKNOWN';

export interface AiConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatFilters {
  projectName?: string | null;
  projectManagerName?: string | null;
  projectStatus?: string | null;
  startDateFrom?: string | null;
  startDateTo?: string | null;
  deadlineFrom?: string | null;
  deadlineTo?: string | null;
  collaboratorName?: string | null;
  taskStatus?: string | null;
  taskPriority?: string | null;
  skills?: string[] | null;
  minCompletionRate?: number | null;
  maxCompletionRate?: number | null;
  hasOverdueTasks?: boolean | null;
  hasBlockedTasks?: boolean | null;
}

export interface AiChatApiRequest {
  message: string;
  conversationHistory: AiConversationMessage[];
  intent: ChatIntent;
}

export interface AiChatResultRow {
  entityType?: 'PROJECT' | 'TASK';
  projectName?: string;
  projectManagerName?: string;
  startDateIso?: string;
  deadlineIso?: string;
  completionRatePercent?: number;
  statusLabel?: string;
  skills?: string[];
  taskTitle?: string;
  taskStatus?: string;
  priority?: string;
  assigneeNames?: string;
  holdReason?: string;
}

export interface AiChatApiResponse {
  assistantMessage: string;
  actionType?: string | null;
  filters?: AiChatFilters | null;
  results: AiChatResultRow[];
  resultCount: number;
  dataSnapshot?: string | null;
  suggestion?: string | null;
  suggestedFollowUps?: string[];
}

export interface AiChatUIMessage extends AiConversationMessage {
  id: number;
  at: Date;
  followUps?: string[];
  pendingRetry?: boolean;
  isTimeout?: boolean;
  isOllamaError?: boolean;
}
