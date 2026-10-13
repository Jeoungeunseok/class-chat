'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { GraduationCap, ArrowRight, ShieldAlert, Users, MessageSquare } from 'lucide-react';
import { Session } from '@/types/chat';

function StudentJoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // URL에서 pin 파라미터 가져오기
  useEffect(() => {
    const pin = searchParams.get('pin');
    if (pin) {
      setPinInput(pin);
    }
  }, [searchParams]);

  // 세션 상태 조회
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/session');
        const data = await res.json();
        setSession(data.session);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 3000);
    return () => clearInterval(interval);
  }, []);

  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!session || !session.isActive) {
      setErrorMsg('현재 진행 중인 수업이 없습니다.');
      return;
    }

    if (!pinInput.trim()) {
      setErrorMsg('참여 PIN 코드를 입력해주세요.');
      return;
    }

    if (pinInput.trim() !== session.pinCode) {
      setErrorMsg('PIN 코드가 올바르지 않습니다. 강사 화면을 확인해주세요.');
      return;
    }

    if (!nameInput.trim()) {
      setErrorMsg('사용할 닉네임을 입력해주세요.');
      return;
    }

    if (nameInput.trim().length > 15) {
      setErrorMsg('닉네임은 15자 이내로 입력해주세요.');
      return;
    }

    setIsJoining(true);
    try {
      const res = await fetch('/api/session/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          pinCode: pinInput.trim(),
          nickname: nameInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || '입장에 실패했습니다.');
        setIsJoining(false);
        return;
      }

      // 로컬 스토리지에 닉네임 저장
      sessionStorage.setItem('chat_nickname', nameInput.trim());
      sessionStorage.setItem('chat_session_id', session.id);

      // 채팅방으로 이동
      router.push(`/chat?sessionId=${session.id}&name=${encodeURIComponent(nameInput.trim())}`);
    } catch {
      setErrorMsg('서버와 통신 중 오류가 발생했습니다.');
      setIsJoining(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 backdrop-blur rounded-2xl mb-3 shadow-inner">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">실시간 수업 채팅</h1>
          <p className="text-blue-100 text-sm mt-1">로그인 없이 QR/PIN으로 빠르게 참여하세요</p>
        </div>

        {/* 본문 */}
        <div className="p-6 sm:p-8">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500">수업 정보를 확인하는 중...</p>
            </div>
          ) : !session || !session.isActive ? (
            /* 열린 수업이 없을 때 */
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-50 text-amber-600 rounded-full mb-4">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">현재 열려있는 수업이 없습니다</h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                강사님이 수업을 시작하고 QR 코드를 띄우면
                <br />
                자동으로 입장할 수 있습니다.
              </p>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                >
                  강사이신가요? 관리자 모드로 수업 열기 →
                </Link>
              </div>
            </div>
          ) : (
            /* 수업이 진행 중일 때 */
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div className="text-left flex-1 min-w-0">
                  <p className="text-xs font-semibold text-emerald-800 truncate">{session.title}</p>
                  <p className="text-[11px] text-emerald-600">수업 진행 중 (참여 가능)</p>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  수업 PIN 코드 (6자리)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="예: 123456"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xl font-bold tracking-widest text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  채팅에 사용할 닉네임
                </label>
                <input
                  type="text"
                  placeholder="예: 2조 홍길동, 질문봇"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                />
              </div>

              <button
                type="submit"
                disabled={isJoining}
                className="w-full mt-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition active:scale-[0.99]"
              >
                <span>{isJoining ? '입장 확인 중...' : '수업 채팅 입장하기'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-4 text-center">
                <Link
                  href="/admin"
                  className="text-xs text-slate-400 hover:text-slate-600 transition"
                >
                  강사 관리자 페이지로 이동
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* 풋터 특성 안내 */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-around text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>최대 30명 동시수용</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
            <span>실시간 소통</span>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function StudentJoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">로딩 중...</div>}>
      <StudentJoinContent />
    </Suspense>
  );
}
