import { NextRequest, NextResponse } from 'next/server';
import { fetchCurrentSession } from '@/lib/dataService';
import { createUploadTicket, isFileStorageConfigured, MAX_FILE_SIZE } from '@/lib/fileStorage';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

// 강사 전용: 파일 업로드용 1회용 토큰 발급
// 실제 파일은 브라우저가 Supabase Storage로 직접 업로드 (Vercel 요청 크기 제한 회피)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, sessionId, fileName, fileSize } = body;

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 });
    }

    if (!isFileStorageConfigured) {
      return NextResponse.json(
        {
          error:
            '파일 업로드가 설정되지 않았습니다. Vercel 환경변수에 SUPABASE_SERVICE_ROLE_KEY를 추가하고 다시 배포해주세요.',
        },
        { status: 501 }
      );
    }

    if (typeof fileName !== 'string' || !fileName.trim()) {
      return NextResponse.json({ error: '파일 이름이 없습니다.' }, { status: 400 });
    }

    const size = Number(fileSize);
    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: '빈 파일은 올릴 수 없습니다.' }, { status: 400 });
    }
    if (size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `파일은 ${MAX_FILE_SIZE / (1024 * 1024)}MB 이하만 올릴 수 있습니다.` },
        { status: 413 }
      );
    }

    const session = await fetchCurrentSession();
    if (!session || session.id !== sessionId || !session.isActive) {
      return NextResponse.json({ error: '진행 중인 수업이 없습니다.' }, { status: 404 });
    }

    const ticket = await createUploadTicket(session.id, fileName);
    return NextResponse.json({ success: true, ...ticket });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : '서버 오류';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
