import { Session, ChatMessage } from '@/types/chat';

// Hot Module Replacement (HMR) 중에도 메모리 상태 유지
interface GlobalStore {
  currentSession: Session | null;
  messages: ChatMessage[];
}

declare global {
  // eslint-disable-next-line no-var
  var __chatStore: GlobalStore | undefined;
}

if (!globalThis.__chatStore) {
  globalThis.__chatStore = {
    currentSession: null,
    messages: [],
  };
}

const store = globalThis.__chatStore;

function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function getCurrentSession(): Session | null {
  return store.currentSession;
}

export function createSession(title: string = '오늘의 실시간 수업'): Session {
  const newSession: Session = {
    id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title,
    pinCode: generatePin(),
    isActive: true,
    isChatMuted: false,
    createdAt: new Date().toISOString(),
  };

  store.currentSession = newSession;
  // 새 세션 시작 시 이전 메시지는 분리하거나 보존할 수 있음
  return newSession;
}

export function closeSession(): Session | null {
  if (!store.currentSession) return null;

  store.currentSession = {
    ...store.currentSession,
    isActive: false,
    closedAt: new Date().toISOString(),
  };

  return store.currentSession;
}

export function toggleMute(muted?: boolean): Session | null {
  if (!store.currentSession) return null;

  store.currentSession = {
    ...store.currentSession,
    isChatMuted: typeof muted === 'boolean' ? muted : !store.currentSession.isChatMuted,
  };

  return store.currentSession;
}

export function getMessages(sessionId: string): ChatMessage[] {
  return store.messages
    .filter((m) => m.sessionId === sessionId && !m.isDeleted)
    .slice(-100); // 최근 100개
}

export function addMessage(
  sessionId: string,
  senderName: string,
  content: string,
  isTeacher: boolean = false
): ChatMessage {
  const msg: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    sessionId,
    senderName,
    content,
    isTeacher,
    isDeleted: false,
    createdAt: new Date().toISOString(),
  };

  store.messages.push(msg);

  // 메모리 관리 (최대 1000개 유지)
  if (store.messages.length > 1000) {
    store.messages = store.messages.slice(-1000);
  }

  return msg;
}

export function deleteMessage(messageId: string): boolean {
  const target = store.messages.find((m) => m.id === messageId);
  if (target) {
    target.isDeleted = true;
    return true;
  }
  return false;
}

export function clearMessages(sessionId: string): void {
  store.messages = store.messages.filter((m) => m.sessionId !== sessionId);
}
