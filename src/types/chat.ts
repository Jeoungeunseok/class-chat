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
  // 강사가 올린 첨부파일 (Supabase Storage 경로)
  filePath?: string;
  fileName?: string;
  fileSize?: number;
}

export interface MessageFile {
  path: string;
  name: string;
  size: number;
}

// Supabase messages 테이블 행 → ChatMessage
export interface MessageRow {
  id: string;
  session_id: string;
  sender_name: string;
  content: string;
  is_teacher?: boolean;
  is_deleted?: boolean;
  created_at: string;
  file_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
}

export function mapMessageRow(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    senderName: row.sender_name,
    content: row.content,
    isTeacher: Boolean(row.is_teacher),
    isDeleted: Boolean(row.is_deleted),
    createdAt: row.created_at,
    filePath: row.file_path || undefined,
    fileName: row.file_name || undefined,
    fileSize: row.file_size ?? undefined,
  };
}

export interface JoinRequest {
  pinCode: string;
  senderName: string;
}
