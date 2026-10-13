'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield,
  KeyRound,
  Play,
  Square,
  VolumeX,
  Volume2,
  Trash2,
  Tv,
  X,
  Send,
  MessageSquare,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [classTitle, setClassTitle] = useState('오늘의 실시간 수업');
  const [actionLoading, setActionLoading] = useState(false);
  const [showProjectorModal, setShowProjectorModal] = useState(false);
  const [teacherMsg, setTeacherMsg] = useState('');

  const {
    session,
    messages,
    setMessages,
    fetchSession,
    fetchMessages,
    notifyLocalBroadcast,
  } = useRealtimeChat({
    sessionId: undefined,
  });

  // 관리자 로그인 확인
  useEffect(() => {
    const savedPass = sessionStorage.getItem('admin_password');
    if (savedPass) {
      setPassword(savedPass);
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        sessionStorage.setItem('admin_password', password);
        setAuthError('');
      } else {
        setAuthError(data.error || '비밀번호가 일치하지 않습니다.');
      }
    } catch {
      setAuthError('로그인 처리 중 오류가 발생했습니다.');
    }
  };

  const handleAdminAction = async (action: 'create' | 'close' | 'toggle_mute' | 'clear_messages') => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          password,
          title: classTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '오류가 발생했습니다.');
      } else {
        await fetchSession();
        notifyLocalBroadcast('SESSION_UPDATE');
        if (action === 'create') {
          setShowProjectorModal(true);
        }
      }
    } catch (e) {
      console.error(e);
      alert('요청 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('이 메시지를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, password }),
      });
      if (res.ok) {
        if (session) {
          fetchMessages(session.id);
          notifyLocalBroadcast('NEW_MESSAGE');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendTeacherMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !teacherMsg.trim()) return;

    const contentToSend = teacherMsg.trim();
    setTeacherMsg('');

    // 낙관적 업데이트: 강사 화면에 즉시 0ms 반영
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      sessionId: session.id,
      senderName: '공지',
      content: contentToSend,
      isTeacher: true,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          senderName: '공지',
          content: contentToSend,
          isTeacher: true,
          password,
        }),
      });

      if (res.ok) {
        fetchMessages(session.id);
        notifyLocalBroadcast('NEW_MESSAGE');
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      console.error(e);
    }
  };

  // 로그인 폼
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">강사 관리자 로그인</h1>
          <p className="text-xs text-slate-500 mt-1">수업 제어 및 QR 발급을 위한 암호를 입력하세요</p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <input
                type="password"
                placeholder="관리자 비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
              />
              {authError && <p className="text-xs text-red-500 mt-2">{authError}</p>}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition"
            >
              <KeyRound className="w-4 h-4" />
              <span>관리자 콘솔 입장</span>
            </button>

            <div className="pt-2">
              <Link href="/" className="text-xs text-slate-400 hover:text-slate-600">
                ← 학생 입장 화면으로 돌아가기
              </Link>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* 상단 네비게이션 */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-800">수업 제어 센터 (강사 전용)</h1>
                <span className="bg-indigo-100 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                수업 세션 개설, QR 코드 투사, 분탕 방지 및 채팅 제어
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sessionStorage.removeItem('admin_password');
                setIsAuthenticated(false);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 border border-slate-200 rounded-lg"
            >
              로그아웃
            </button>
          </div>
        </header>

        {/* 세션 제어 및 전체 화면 모니터링 보드 */}
        <div className="space-y-6">
          {/* 세션 컨트롤 바 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <h2 className="font-bold text-slate-800 text-sm">현재 수업 제어</h2>
              </div>
              {session?.isActive ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  수업 진행 중 (참여 가능)
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                  수업 대기/종료 상태
                </span>
              )}
            </div>

            {session?.isActive ? (
              <div className="mt-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{session.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        개설 시각: {new Date(session.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg text-xs font-bold text-indigo-700">
                      <span>참여 PIN:</span>
                      <span className="tracking-widest font-mono text-sm">{session.pinCode}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowProjectorModal(true)}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition shadow-sm shadow-indigo-100"
                  >
                    <Tv className="w-4 h-4" />
                    <span>QR 크게 띄우기</span>
                  </button>
                </div>

                {/* 컨트롤 버튼 그룹 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAdminAction('toggle_mute')}
                    className={`py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition ${
                      session.isChatMuted
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {session.isChatMuted ? (
                      <>
                        <VolumeX className="w-4 h-4" />
                        <span>채팅 얼리기 (음소거 중)</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 text-emerald-600" />
                        <span>채팅 활성화 상태</span>
                      </>
                    )}
                  </button>

                  <button
                    disabled={actionLoading}
                    onClick={() => {
                      if (confirm('채팅 기록을 모두 비우시겠습니까?')) {
                        handleAdminAction('clear_messages');
                      }
                    }}
                    className="py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <Trash2 className="w-4 h-4 text-slate-400" />
                    <span>채팅 내역 비우기</span>
                  </button>

                  <button
                    disabled={actionLoading}
                    onClick={() => {
                      if (confirm('수업을 종료하시겠습니까? 학생들의 채팅방이 즉시 잠깁니다.')) {
                        handleAdminAction('close');
                      }
                    }}
                    className="py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm shadow-rose-100"
                  >
                    <Square className="w-4 h-4" />
                    <span>수업 종료 (방 닫기)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-slate-600">
                  수업을 시작하면 새로운 6자리 PIN과 일회성 참여 QR 코드가 발급됩니다.
                </p>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    수업 주제 / 강의명
                  </label>
                  <input
                    type="text"
                    value={classTitle}
                    onChange={(e) => setClassTitle(e.target.value)}
                    placeholder="예: 10월 13일 실시간 특강"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  disabled={actionLoading}
                  onClick={() => handleAdminAction('create')}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-md shadow-emerald-200"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>새 수업 시작하기 (QR 및 PIN 생성)</span>
                </button>
              </div>
            )}
          </div>

          {/* 와이드 실시간 질문 모니터링 섹션 (전체 가로 너비 활용) */}
          {session?.isActive && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                  <h2 className="font-bold text-slate-800 text-base">실시간 수업 질문 및 대화 모니터링</h2>
                </div>
                <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
                  총 {messages.length}개 메시지
                </span>
              </div>

              {/* 공지 발송 입력창 */}
              <form onSubmit={handleSendTeacherMessage} className="flex gap-2">
                <input
                  type="text"
                  placeholder="공지 메시지를 입력하세요"
                  value={teacherMsg}
                  onChange={(e) => setTeacherMsg(e.target.value)}
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                />
                <button
                  type="submit"
                  className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>발송</span>
                </button>
              </form>

              {/* 대형 메시지 피드 (높이 600px, 와이드 뷰) */}
              <div className="h-[600px] overflow-y-auto space-y-3 border border-slate-200 rounded-2xl p-4 bg-slate-50/70">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                    <MessageSquare className="w-10 h-10 stroke-[1.5] opacity-40" />
                    <p className="text-sm font-medium">아직 등록된 학생 질문이 없습니다.</p>
                    <p className="text-xs text-slate-400">학생들이 QR을 스캔하고 질문을 작성하면 실시간으로 여기에 크게 표시됩니다.</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`p-4 rounded-xl border transition shadow-sm ${
                        m.isTeacher
                          ? 'bg-indigo-50/80 border-indigo-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold ${
                              m.isTeacher ? 'text-indigo-700' : 'text-slate-800'
                            }`}
                          >
                            {m.senderName}
                          </span>
                          {m.isTeacher && (
                            <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">
                              공지
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteMessage(m.id)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                          title="분탕 메시지 삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* 메시지 내용 (전문 줄바꿈 표시) */}
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words pl-0.5">
                        {m.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 빔프로젝터용 대형 QR 코드 팝업 모달 */}
      {showProjectorModal && session?.isActive && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full relative shadow-2xl flex flex-col items-center">
            <button
              onClick={() => setShowProjectorModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              <h2 className="text-2xl font-black text-slate-900">{session.title}</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6 text-center">
              스마트폰 카메라로 아래 QR 코드를 비추면 즉시 참여할 수 있습니다.
            </p>

            <QRCodeDisplay pinCode={session.pinCode} sessionId={session.id} isProjectorMode={true} />

            <button
              onClick={() => setShowProjectorModal(false)}
              className="mt-8 px-6 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition"
            >
              대시보드로 돌아가기
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
