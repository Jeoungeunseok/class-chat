import { Session, ChatMessage } from '@/types/chat';
import { supabase, isSupabaseConfigured } from './supabase';
import * as memoryStore from './memoryStore';

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
      // 1. 기존 활성 세션 비활성화
      await supabase
        .from('sessions')
        .update({ is_active: false, closed_at: new Date().toISOString() })
        .eq('is_active', true);

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
      const { data, error } = await supabase
        .from('sessions')
        .update({ is_active: false, closed_at: new Date().toISOString() })
        .eq('is_active', true)
        .select()
        .maybeSingle();

      if (data?.id) {
        // 수업 종료 시 해당 세션의 DB 메시지 완전 영구 삭제 (완전 휘발성)
        await purgeMessages(data.id);
      }

      if (error || !data) {
        const closed = memoryStore.closeSession();
        if (closed) memoryStore.clearMessages(closed.id);
        return closed;
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
      const closed = memoryStore.closeSession();
      if (closed) memoryStore.clearMessages(closed.id);
      return closed;
    }
  }

  const closed = memoryStore.closeSession();
  if (closed) memoryStore.clearMessages(closed.id);
  return closed;
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

export async function fetchMessages(sessionId: string): Promise<ChatMessage[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        console.error('Supabase fetchMessages error:', error);
        return memoryStore.getMessages(sessionId);
      }

      return (data || []).map((m) => ({
        id: m.id,
        sessionId: m.session_id,
        senderName: m.sender_name,
        content: m.content,
        isTeacher: m.is_teacher,
        isDeleted: m.is_deleted,
        createdAt: m.created_at,
      }));
    } catch {
      return memoryStore.getMessages(sessionId);
    }
  }

  return memoryStore.getMessages(sessionId);
}

export async function postMessage(
  sessionId: string,
  senderName: string,
  content: string,
  isTeacher: boolean = false
): Promise<ChatMessage> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          session_id: sessionId,
          sender_name: senderName,
          content,
          is_teacher: isTeacher,
          is_deleted: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase postMessage error:', error);
        return memoryStore.addMessage(sessionId, senderName, content, isTeacher);
      }

      return {
        id: data.id,
        sessionId: data.session_id,
        senderName: data.sender_name,
        content: data.content,
        isTeacher: data.is_teacher,
        isDeleted: data.is_deleted,
        createdAt: data.created_at,
      };
    } catch {
      return memoryStore.addMessage(sessionId, senderName, content, isTeacher);
    }
  }

  return memoryStore.addMessage(sessionId, senderName, content, isTeacher);
}

export async function removeMessage(messageId: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_deleted: true })
        .eq('id', messageId);

      if (error) return memoryStore.deleteMessage(messageId);
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

export async function checkAndRegisterNickname(
  sessionId: string,
  nickname: string
): Promise<{ success: boolean; error?: string }> {
  const trimmed = nickname.trim();
  const normalized = trimmed.toLowerCase();

  // 사칭 방지 예약어
  const reserved = ['강사', '공지', '관리자', 'admin', 'teacher', 'operator'];
  if (reserved.includes(normalized)) {
    return { success: false, error: '해당 닉네임은 사용할 수 없습니다 (예약어).' };
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
