export interface Session {
  id: string;
  title: string;
  pinCode: string;
  isActive: boolean;
  isChatMuted: boolean;
  createdAt: string;
  closedAt?: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderName: string;
  content: string;
  isTeacher?: boolean;
  isDeleted?: boolean;
  createdAt: string;
}

export interface JoinRequest {
  pinCode: string;
  senderName: string;
}
