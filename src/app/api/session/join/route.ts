import { NextRequest, NextResponse } from 'next/server';
import { fetchCurrentSession, checkAndRegisterNickname } from '@/lib/dataService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, pinCode, nickname } = body;

    if (!sessionId || !pinCode || !nickname?.trim()) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
    }

    const trimmedName = nickname.trim();
    if (trimmedName.length > 15) {
      return NextResponse.json({ error: '닉네임은 15자 이내로 입력해주세요.' }, { status: 400 });
    }

    const session = await fetchCurrentSession();

    if (!session || session.id !== sessionId || !session.isActive) {
      return NextResponse.json(
        { error: '현재 진행 중인 수업이 아니거나 세션이 종료되었습니다.' },
        { status: 404 }
      );
    }

    if (session.pinCode !== pinCode.trim()) {
      return NextResponse.json({ error: '수업 PIN 코드가 올바르지 않습니다.' }, { status: 400 });
    }

    // 닉네임 중복 검증
    const checkResult = await checkAndRegisterNickname(sessionId, trimmedName);
    if (!checkResult.success) {
      return NextResponse.json({ error: checkResult.error }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : '서버 오류';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
