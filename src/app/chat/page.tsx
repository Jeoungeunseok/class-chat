'use client';

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Send,
  LogOut,
  VolumeX,
  ShieldAlert,
  Users,
  Crown,
  Sparkles,
} from 'lucide-react';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';

function ChatRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sessionId = searchParams.get('sessionId') || '';
  const myName = searchParams.get('name') || '';

  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    session,
    messages,
    loading,
    setMessages,
    fetchMessages,
    notifyLocalBroadcast,
  } = useRealtimeChat({
    sessionId: sessionId || undefined,
  });

  // 유효한 접근인지 확인
  useEffect(() => {
    if (!sessionId || !myName) {
      router.replace('/');
    }
  }, [sessionId, myName, router]);

  // 새 메시지 시 하단 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isSending) return;

    if (!session || !session.isActive) {
      alert('수업이 종료되어 메시지를 보낼 수 없습니다.');
      return;
    }

    if (session.isChatMuted) {
      alert('현재 강사님이 채팅을 일시 정지했습니다.');
      return;
    }

    const contentToSend = inputMessage.trim();
    setInputMessage('');

    // 낙관적 업데이트: 내 화면에 즉시 0ms로 메시지 반영
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      sessionId,
      senderName: myName,
      content: contentToSend,
      isTeacher: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          senderName: myName,
          content: contentToSend,
          isTeacher: false,
        }),
      });

      if (res.ok) {
        await fetchMessages(sessionId);
        notifyLocalBroadcast('NEW_MESSAGE');
      } else {
        // 실패 시 롤백
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        const data = await res.json();
        alert(data.error || '메시지 전송에 실패했습니다.');
      }
    } catch (e) {
      // 실패 시 롤백
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      console.error(e);
      alert('메시지 전송 중 통신 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const isClosed = !session || !session.isActive;
  const isMuted = session?.isChatMuted;

  return (
    <main className="flex flex-col h-screen max-h-screen bg-slate-100 overflow-hidden">
      {/* 헤더 */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
            {myName.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-800 truncate">
              {session?.title || '실시간 수업 채팅'}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="font-semibold text-indigo-600">{myName}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isClosed ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                {isClosed ? '수업 종료됨' : '참여 중'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (confirm('채팅방을 나가시겠습니까?')) {
                router.push('/');
              }
            }}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition"
            title="나가기"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 상태 알림 배너 */}
      {isClosed && !loading && (
        <div className="bg-rose-500 text-white text-xs py-2 px-4 flex items-center justify-center gap-2 font-medium shrink-0 shadow-inner">
          <ShieldAlert className="w-4 h-4" />
          <span>수업이 종료되었습니다. 더 이상 메시지를 보낼 수 없습니다.</span>
        </div>
      )}

      {isMuted && !isClosed && (
        <div className="bg-amber-500 text-white text-xs py-2 px-4 flex items-center justify-center gap-2 font-medium shrink-0 shadow-inner">
          <VolumeX className="w-4 h-4" />
          <span>강사님이 채팅을 일시 정지(음소거)했습니다. 설명에 집중해주세요!</span>
        </div>
      )}

      {/* 메시지 리스트 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="text-center py-2">
          <span className="text-[11px] bg-slate-200/70 text-slate-600 px-3 py-1 rounded-full">
            수업 시작 시점부터 작성된 실시간 대화입니다
          </span>
        </div>

        {messages.map((msg) => {
          const isMe = msg.senderName === myName;
          const isTeacher = msg.isTeacher;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              {!isMe && (
                <div className="flex items-center gap-1.5 mb-1 ml-1 text-xs text-slate-500 font-medium">
                  {isTeacher && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                  <span className={isTeacher ? 'text-indigo-600 font-bold' : ''}>
                    {isTeacher ? '강사' : msg.senderName}
                  </span>
                </div>
              )}

              <div className="flex items-end gap-1.5 max-w-[85%] sm:max-w-[70%]">
                {isMe && (
                  <span className="text-[10px] text-slate-400 shrink-0 select-none pb-0.5">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}

                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-sm ${
                    isTeacher
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tl-sm ring-2 ring-indigo-200'
                      : isMe
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                </div>

                {!isMe && (
                  <span className="text-[10px] text-slate-400 shrink-0 select-none pb-0.5">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* 하단 입력바 */}
      <footer className="bg-white border-t border-slate-200 p-3 shrink-0">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              rows={1}
              disabled={Boolean(isClosed || isMuted)}
              placeholder={
                isClosed
                  ? '수업이 종료되었습니다'
                  : isMuted
                  ? '강사님이 채팅을 일시 정지했습니다'
                  : '메시지를 입력하세요'
              }
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`w-full resize-none max-h-32 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition ${
                isClosed || isMuted ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={Boolean(isClosed || isMuted || !inputMessage.trim() || isSending)}
            className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-2xl transition shadow-md shadow-indigo-100 disabled:shadow-none shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </main>
  );
}

export default function ChatRoomPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-slate-100">채팅방을 불러오는 중...</div>}>
      <ChatRoomContent />
    </Suspense>
  );
}
