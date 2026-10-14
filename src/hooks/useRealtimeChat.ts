'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Session, ChatMessage } from '@/types/chat';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface UseRealtimeChatProps {
  sessionId?: string;
  adminPassword?: string;
  onSessionClosed?: () => void;
}

export function useRealtimeChat({ sessionId, adminPassword, onSessionClosed }: UseRealtimeChatProps = {}) {
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
        const serverMessages: ChatMessage[] = data.messages;
        // 전송 중인 낙관적 메시지(temp_*)는 서버 목록에 반영될 때까지 유지 (폴링 시 깜빡임 방지)
        setMessages((prev) => {
          const pending = prev.filter(
            (m) =>
              m.id.startsWith('temp_') &&
              !serverMessages.some(
                (s) => s.senderName === m.senderName && s.content === m.content
              )
          );
          return pending.length > 0 ? [...serverMessages, ...pending] : serverMessages;
        });
      }
    } catch (e) {
      console.error('Failed to fetch messages', e);
    }
  }, []);

  // 2. 세션 정보 조회
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/session', {
        headers: adminPassword ? { 'x-admin-password': adminPassword } : undefined,
      });
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
  }, [adminPassword, onSessionClosed]);

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

  // 5. 웹소켓 누락 방지용 백업 폴링 (3초 간격)
  useEffect(() => {
    if (!activeSessionId) return;

    fetchMessages(activeSessionId);

    const interval = setInterval(() => {
      fetchSession();
      fetchMessages(activeSessionId);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeSessionId, fetchSession, fetchMessages]);

  // 6. Supabase Realtime (postgres_changes) 구독 - 웹소켓 페이로드 즉시 주입 (0ms 지연)
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
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as {
              id: string;
              session_id: string;
              sender_name: string;
              content: string;
              is_teacher?: boolean;
              is_deleted?: boolean;
              created_at: string;
            };

            if (!row || row.is_deleted) return;

            const newMsg: ChatMessage = {
              id: row.id,
              sessionId: row.session_id,
              senderName: row.sender_name,
              content: row.content,
              isTeacher: Boolean(row.is_teacher),
              isDeleted: Boolean(row.is_deleted),
              createdAt: row.created_at,
            };

            setMessages((prev) => {
              // 1. 이미 동일한 실제 ID가 있으면 무시
              if (prev.some((m) => m.id === newMsg.id)) return prev;

              // 2. 내가 방금 생성한 낙관적 메시지(temp_*)가 있다면 정식 메시지로 치환
              const tempIndex = prev.findIndex(
                (m) =>
                  m.id.startsWith('temp_') &&
                  m.senderName === newMsg.senderName &&
                  m.content === newMsg.content
              );

              if (tempIndex !== -1) {
                const next = [...prev];
                next[tempIndex] = newMsg;
                return next;
              }

              // 3. 상대방이 보낸 새 메시지 -> 즉시 반영 (0ms 지연)
              return [...prev, newMsg];
            });
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as {
              id: string;
              session_id: string;
              sender_name: string;
              content: string;
              is_teacher?: boolean;
              is_deleted?: boolean;
              created_at: string;
            };

            if (!row) return;

            if (row.is_deleted) {
              // 삭제된 메시지는 화면에서 즉각 제거
              setMessages((prev) => prev.filter((m) => m.id !== row.id));
            } else {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === row.id
                    ? {
                        ...m,
                        content: row.content,
                        isDeleted: Boolean(row.is_deleted),
                        isTeacher: Boolean(row.is_teacher),
                      }
                    : m
                )
              );
            }
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id?: string };
            if (oldRow?.id) {
              setMessages((prev) => prev.filter((m) => m.id !== oldRow.id));
            } else {
              setMessages([]);
            }
          }
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
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as {
              id: string;
              title: string;
              pin_code: string;
              is_active: boolean;
              is_chat_muted: boolean;
              created_at: string;
              closed_at?: string | null;
            };

            if (!row) return;

            const updatedSession: Session = {
              id: row.id,
              title: row.title,
              pinCode: row.pin_code,
              isActive: Boolean(row.is_active),
              isChatMuted: Boolean(row.is_chat_muted),
              createdAt: row.created_at,
              closedAt: row.closed_at || undefined,
            };

            setSession(updatedSession);
            if (!updatedSession.isActive && onSessionClosed) {
              onSessionClosed();
            }
          } else if (payload.eventType === 'DELETE') {
            setSession(null);
            setMessages([]);
            if (onSessionClosed) {
              onSessionClosed();
            }
          }
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(sub);
    };
  }, [activeSessionId, onSessionClosed]);

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
