import { NextRequest, NextResponse } from 'next/server';
import {
  fetchCurrentSession,
  fetchMessages,
  postMessage,
  removeMessage,
  isReservedNickname,
} from '@/lib/dataService';
import { isValidSessionFilePath, MAX_FILE_SIZE } from '@/lib/fileStorage';
import { MessageFile } from '@/types/chat';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId가 필요합니다.' }, { status: 400 });
  }

  // all=1: 수업 종료 시 채팅 기록 다운로드용 전체 조회
  const limit = searchParams.get('all') === '1' ? 5000 : 300;
  const messages = await fetchMessages(sessionId, limit);
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, senderName, content, isTeacher, password, pinCode, file } = body;
    const hasFile = Boolean(file && typeof file === 'object');

    if (!sessionId || !senderName || (!content?.trim() && !hasFile)) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
    }

    const session = await fetchCurrentSession();

    // 세션 유효성 검사
    if (!session || session.id !== sessionId) {
      return NextResponse.json(
        { error: '존재하지 않거나 만료된 세션입니다.' },
        { status: 404 }
      );
    }

    if (!session.isActive) {
      return NextResponse.json(
        { error: '수업이 종료되어 메시지를 보낼 수 없습니다.' },
        { status: 403 }
      );
    }

    // 관리자(강사) 검증
    const isVerifiedTeacher = isTeacher && password === ADMIN_PASSWORD;

    // 학생은 PIN을 아는 경우에만 메시지 전송 가능 (URL 직접 접근 차단)
    if (!isVerifiedTeacher && String(pinCode ?? '').trim() !== session.pinCode) {
      return NextResponse.json(
        { error: '입장 정보가 올바르지 않습니다. 첫 화면에서 PIN으로 다시 입장해주세요.' },
        { status: 403 }
      );
    }

    // 채팅 음소거 상태 검사 (강사는 예외)
    if (session.isChatMuted && !isVerifiedTeacher) {
      return NextResponse.json(
        { error: '현재 강사님이 채팅을 일시 정지(음소거)했습니다.' },
        { status: 403 }
      );
    }

    // 학생이 URL 조작으로 '강사' 등 예약 닉네임을 쓰는 것 차단
    if (!isVerifiedTeacher && isReservedNickname(senderName)) {
      return NextResponse.json(
        { error: '사용할 수 없는 닉네임입니다.' },
        { status: 403 }
      );
    }

    // 첨부파일은 강사만, 해당 수업 폴더에 업로드된 파일만 허용
    let attachedFile: MessageFile | undefined;
    if (hasFile) {
      if (!isVerifiedTeacher) {
        return NextResponse.json({ error: '파일은 강사만 올릴 수 있습니다.' }, { status: 403 });
      }
      const size = Number(file.size);
      if (
        !isValidSessionFilePath(sessionId, file.path) ||
        typeof file.name !== 'string' ||
        !file.name.trim() ||
        !Number.isFinite(size) ||
        size < 0 ||
        size > MAX_FILE_SIZE
      ) {
        return NextResponse.json({ error: '첨부파일 정보가 올바르지 않습니다.' }, { status: 400 });
      }
      attachedFile = { path: file.path, name: file.name.trim().slice(0, 200), size };
    }

    // 메시지 글자 수 제한
    const sanitizedContent = String(content ?? '').trim().slice(0, 500);

    const message = await postMessage(
      sessionId,
      senderName.slice(0, 20),
      sanitizedContent,
      isVerifiedTeacher,
      attachedFile
    );

    return NextResponse.json({ success: true, message });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : '서버 오류';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { messageId, password } = body;

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 401 }
      );
    }

    const success = await removeMessage(messageId);
    if (!success) {
      return NextResponse.json({ error: '메시지를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : '서버 오류';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
