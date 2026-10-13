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

  // 활성 세션 ID (직접 전달받은 ID가 없으면 현재 활성 세션의 ID 사용)
  const activeSessionId = sessionId || session?.id;

  // 1. 메시지 목록 조회
  const fetchMessages = useCallback(async (targetSessionId: string) => {
    if (!targetSessionId) return;
    try {
      const res = await fetch(`/api/messages?sessionId=${encodeURIComponent(targetSessionId)}`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (e) {
      console.error('Failed to fetch messages', e);
    }
  }, []);

  // 2. 세션 정보 조회
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
      return data.session as Session | null;
    } catch (e) {
      console.error('Failed to fetch session', e);
      return null;
    }
  }, [onSessionClosed]);

  // 3. 브로드캐스트 이벤트 전파 (로컬 창 간 실시간)
  const notifyLocalBroadcast = useCallback((type: 'NEW_MESSAGE' | 'SESSION_UPDATE') => {
    if (channelRef.current) {
      channelRef.current.postMessage({ type });
    }
  }, []);

  // 4. 초기 세션 조회 및 BroadcastChannel 리스너
  useEffect(() => {
    fetchSession().then((sess) => {
      setLoading(false);
      if (sess && !sessionId) {
        fetchMessages(sess.id);
      }
    });

    const bc = new BroadcastChannel('class_chat_channel');
    channelRef.current = bc;

    bc.onmessage = (event) => {
      if (event.data?.type === 'NEW_MESSAGE' && activeSessionId) {
        fetchMessages(activeSessionId);
      }
      if (event.data?.type === 'SESSION_UPDATE') {
        fetchSession().then((sess) => {
          if (sess) fetchMessages(sess.id);
        });
      }
    };

    return () => {
      bc.close();
    };
  }, [sessionId, activeSessionId, fetchSession, fetchMessages]);

  // 5. 활성 세션에 대한 실시간 메시지 폴링 (1초 간격)
  useEffect(() => {
    if (!activeSessionId) return;

    fetchMessages(activeSessionId);

    const interval = setInterval(() => {
      fetchSession();
      fetchMessages(activeSessionId);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSessionId, fetchSession, fetchMessages]);

  // 6. Supabase Realtime (postgres_changes) 구독
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !activeSessionId) return;

    const client = supabase;
    const channelName = `realtime_changes_${activeSessionId}`;

    const sub = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `session_id=eq.${activeSessionId}`,
        },
        () => {
          fetchMessages(activeSessionId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${activeSessionId}`,
        },
        () => {
          fetchSession();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(sub);
    };
  }, [activeSessionId, fetchSession, fetchMessages]);

  return {
    session,
    messages,
    setMessages,
    loading,
    onlineCount,
    setOnlineCount,
    fetchSession,
    fetchMessages,
    notifyLocalBroadcast,
  };
}
