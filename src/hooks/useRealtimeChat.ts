'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Session, ChatMessage } from '@/types/chat';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface UseRealtimeChatProps {
  sessionId?: string;
  onSessionClosed?: () => void;
}

export function useRealtimeChat({ sessionId, onSessionClosed }: UseRealtimeChatProps = {}) {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // 1. 세션 정보 조회
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/session');
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        if (!data.session.isActive && onSessionClosed) {
          onSessionClosed();
        }
      } else {
        setSession(null);
      }
    } catch (e) {
      console.error('Failed to fetch session', e);
    }
  }, [onSessionClosed]);

  // 2. 메시지 목록 조회
  const fetchMessages = useCallback(async (currentSessionId: string) => {
    try {
      const res = await fetch(`/api/messages?sessionId=${encodeURIComponent(currentSessionId)}`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (e) {
      console.error('Failed to fetch messages', e);
    }
  }, []);

  // 3. 브로드캐스트 이벤트 전파 (로컬 창 간 실시간)
  const notifyLocalBroadcast = useCallback((type: 'NEW_MESSAGE' | 'SESSION_UPDATE') => {
    if (channelRef.current) {
      channelRef.current.postMessage({ type });
    }
  }, []);

  // 4. 초기화 및 실시간 리스너 연결
  useEffect(() => {
    fetchSession().finally(() => setLoading(false));

    // BroadcastChannel 설정 (탭 간 즉각 동기화)
    const bc = new BroadcastChannel('class_chat_channel');
    channelRef.current = bc;

    bc.onmessage = (event) => {
      if (event.data?.type === 'NEW_MESSAGE' && sessionId) {
        fetchMessages(sessionId);
      }
      if (event.data?.type === 'SESSION_UPDATE') {
        fetchSession();
      }
    };

    // 주기적 동기화 폴백 (1.5초 간격)
    const interval = setInterval(() => {
      fetchSession();
      if (sessionId) {
        fetchMessages(sessionId);
      }
    }, 1500);

    // Supabase 설정 시 Supabase Realtime 구독
    let supabaseSub: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
    if (isSupabaseConfigured && supabase && sessionId) {
      const client = supabase;
      supabaseSub = client
        .channel(`room_${sessionId}`)
        .on('broadcast', { event: 'new_msg' }, () => {
          fetchMessages(sessionId);
        })
        .on('broadcast', { event: 'session_change' }, () => {
          fetchSession();
        })
        .subscribe();
    }

    return () => {
      bc.close();
      clearInterval(interval);
      if (supabaseSub && supabase) {
        supabase.removeChannel(supabaseSub);
      }
    };
  }, [sessionId, fetchSession, fetchMessages]);

  useEffect(() => {
    if (sessionId) {
      fetchMessages(sessionId);
    }
  }, [sessionId, fetchMessages]);

  return {
    session,
    messages,
    loading,
    onlineCount,
    setOnlineCount,
    fetchSession,
    fetchMessages,
    notifyLocalBroadcast,
  };
}
