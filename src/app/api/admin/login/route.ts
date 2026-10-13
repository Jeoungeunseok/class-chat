import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });
    }

    if (password === ADMIN_PASSWORD) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: '비밀번호가 일치하지 않습니다.' },
        { status: 401 }
      );
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : '서버 오류';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
