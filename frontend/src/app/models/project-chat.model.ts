export interface ProjectChatMessage {
  id: number;
  projectId: number;
  senderLabel: string;
  fromCurrentUser: boolean;
  content: string;
  read: boolean;
  createdAt: string;
}

export interface ProjectChatUnreadCount {
  count: number;
}
