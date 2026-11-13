import { Session, ChatMessage, MessageFile, MessageRow, mapMessageRow } from '@/types/chat';
import { supabase, isSupabaseConfigured } from './supabase';
import * as memoryStore from './memoryStore';
import { removeAllFiles, removeFiles } from './fileStorage';

function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function fetchCurrentSession(): Promise<Session | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Supabase fetchCurrentSession error:', error);
        return memoryStore.getCurrentSession();
      }

      if (!data) return null;

      return {
        id: data.id,
        title: data.title,
        pinCode: data.pin_code,
        isActive: data.is_active,
        isChatMuted: data.is_chat_muted,
        createdAt: data.created_at,
        closedAt: data.closed_at,
      };
    } catch (e) {
      console.error('Error fetching session from Supabase:', e);
      return memoryStore.getCurrentSession();
    }
  }

  return memoryStore.getCurrentSession();
}

export async function startNewSession(title: string): Promise<Session> {
  const pin = generatePin();

  if (isSupabaseConfigured && supabase) {
    try {
      // 1. 이전 잔여 데이터 완전 삭제 (단일 세션 유지)
      await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await removeAllFiles();
      memoryStore.clearAllData();

      // 2. 새 세션 생성
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          title,
          pin_code: pin,
          is_active: true,
          is_chat_muted: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase startNewSession error:', error);
        return memoryStore.createSession(title);
      }

      return {
        id: data.id,
        title: data.title,
        pinCode: data.pin_code,
        isActive: data.is_active,
        isChatMuted: data.is_chat_muted,
        createdAt: data.created_at,
      };
    } catch (e) {
      console.error('Error creating session in Supabase:', e);
      return memoryStore.createSession(title);
    }
  }

  return memoryStore.createSession(title);
}

export async function endSession(): Promise<Session | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Supabase 메시지 테이블 전체 영구 삭제 (0행)
      await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // 2. Supabase 세션 테이블 전체 영구 삭제 (0행)
      await supabase.from('sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // 3. 업로드된 수업 자료 파일 전체 삭제
      await removeAllFiles();

      // 4. 인메모리 스토어 전체 영구 삭제
      memoryStore.clearAllData();
      return null;
    } catch (e) {
      console.error('Error ending session:', e);
      memoryStore.clearAllData();
      return null;
    }
  }

  memoryStore.clearAllData();
  return null;
}

export async function setChatMute(muted?: boolean): Promise<Session | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const current = await fetchCurrentSession();
      if (!current) return null;

      const nextMuted = typeof muted === 'boolean' ? muted : !current.isChatMuted;

      const { data, error } = await supabase
        .from('sessions')
        .update({ is_chat_muted: nextMuted })
        .eq('id', current.id)
        .select()
        .single();

      if (error || !data) {
        return memoryStore.toggleMute(muted);
      }

      return {
        id: data.id,
        title: data.title,
        pinCode: data.pin_code,
        isActive: data.is_active,
        isChatMuted: data.is_chat_muted,
        createdAt: data.created_at,
        closedAt: data.closed_at,
      };
    } catch {
      return memoryStore.toggleMute(muted);
    }
  }

  return memoryStore.toggleMute(muted);
}

export async function fetchMessages(
  sessionId: string,
  limit: number = 300
): Promise<ChatMessage[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      // 최신 메시지 기준으로 limit개를 가져온 뒤 시간순으로 뒤집음
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Supabase fetchMessages error:', error);
        return memoryStore.getMessages(sessionId, limit);
      }

      return ((data || []) as MessageRow[]).reverse().map(mapMessageRow);
    } catch {
      return memoryStore.getMessages(sessionId, limit);
    }
  }

  return memoryStore.getMessages(sessionId, limit);
}

export async function postMessage(
  sessionId: string,
  senderName: string,
  content: string,
  isTeacher: boolean = false,
  file?: MessageFile
): Promise<ChatMessage> {
  if (isSupabaseConfigured && supabase) {
    // 파일 컬럼은 첨부가 있을 때만 넣음 (컬럼 추가 SQL 실행 전에도 일반 채팅은 정상 동작)
    const fileColumns = file
      ? { file_path: file.path, file_name: file.name, file_size: file.size }
      : {};

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          session_id: sessionId,
          sender_name: senderName,
          content,
          is_teacher: isTeacher,
          is_deleted: false,
          ...fileColumns,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase postMessage error:', error);
        if (file) {
          // 파일은 Supabase에만 저장되므로 메모리로 대체하지 않고 원인을 알림
          throw new Error(
            '파일 메시지 저장에 실패했습니다. Supabase에서 파일 컬럼 추가 SQL(schema.sql 5번)을 실행했는지 확인해주세요.'
          );
        }
        return memoryStore.addMessage(sessionId, senderName, content, isTeacher);
      }

      return mapMessageRow(data as MessageRow);
    } catch (e) {
      if (file) throw e;
      return memoryStore.addMessage(sessionId, senderName, content, isTeacher);
    }
  }

  return memoryStore.addMessage(sessionId, senderName, content, isTeacher, file);
}

export async function removeMessage(messageId: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .update({ is_deleted: true })
        .eq('id', messageId)
        .select('*')
        .maybeSingle();

      if (error) return memoryStore.deleteMessage(messageId);

      // 첨부파일이 있는 메시지면 저장소 파일도 삭제
      const filePath = (data as MessageRow | null)?.file_path;
      if (filePath) await removeFiles([filePath]);
      return true;
    } catch {
      return memoryStore.deleteMessage(messageId);
    }
  }

  return memoryStore.deleteMessage(messageId);
}

export async function purgeMessages(sessionId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('messages')
        .delete()
        .eq('session_id', sessionId);
    } catch {
      memoryStore.clearMessages(sessionId);
    }
  }
  memoryStore.clearMessages(sessionId);
}

// 사칭 방지 예약어
const RESERVED_NICKNAMES = ['강사', '공지', '관리자', 'admin', 'teacher', 'operator'];

export function isReservedNickname(nickname: string): boolean {
  return RESERVED_NICKNAMES.includes(nickname.trim().toLowerCase());
}

export async function checkAndRegisterNickname(
  sessionId: string,
  nickname: string,
  isRejoin: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const trimmed = nickname.trim();
  const normalized = trimmed.toLowerCase();

  if (isReservedNickname(normalized)) {
    return { success: false, error: '해당 닉네임은 사용할 수 없습니다 (예약어).' };
  }

  // 같은 브라우저에서 같은 닉네임으로 다시 들어오는 경우 (재입장 토큰 검증됨)
  if (isRejoin) {
    return { success: true };
  }

  // 1. Supabase 메시지 테이블에서 이미 발언한 닉네임인지 확인
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: msgData, error } = await supabase
        .from('messages')
        .select('id')
        .eq('session_id', sessionId)
        .ilike('sender_name', trimmed)
        .limit(1);

      if (!error && msgData && msgData.length > 0) {
        return { success: false, error: '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요.' };
      }
    } catch (e) {
      console.error('Error checking nickname in Supabase:', e);
    }
  }

  // 2. 인메모리 참가자 목록 검사 및 등록
  return memoryStore.checkNickname(sessionId, trimmed);
}
