import { NextRequest, NextResponse } from 'next/server';
import {
  fetchCurrentSession,
  startNewSession,
  endSession,
  setChatMute,
  purgeMessages,
} from '@/lib/dataService';
import { isSupabaseConfigured } from '@/lib/supabase';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

export async function GET() {
  const session = await fetchCurrentSession();
  return NextResponse.json({
    session,
    isSupabaseConfigured,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, password, title, muted } = body;

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: '관리자 비밀번호가 일치하지 않습니다.' },
        { status: 401 }
      );
    }

    if (action === 'create') {
      const session = await startNewSession(title || '오늘의 실시간 수업');
      return NextResponse.json({ success: true, session });
    }

    if (action === 'close') {
      const session = await endSession();
      return NextResponse.json({ success: true, session });
    }

    if (action === 'toggle_mute') {
      const session = await setChatMute(muted);
      return NextResponse.json({ success: true, session });
    }

    if (action === 'clear_messages') {
      const current = await fetchCurrentSession();
      if (current) {
        await purgeMessages(current.id);
      }
      return NextResponse.json({ success: true, message: '채팅 기록이 초기화되었습니다.' });
    }

    return NextResponse.json({ error: '알 수 없는 요청입니다.' }, { status: 400 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : '서버 오류';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
