import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.ADMIN_PASSWORD || 'admin1234';

// 같은 브라우저가 같은 닉네임으로 재입장할 수 있도록 발급하는 서명 토큰 (서버 저장소 불필요)
export function createJoinToken(sessionId: string, nickname: string): string {
  return createHmac('sha256', SECRET)
    .update(`${sessionId}:${nickname.trim().toLowerCase()}`)
    .digest('hex');
}

export function verifyJoinToken(sessionId: string, nickname: string, token?: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const expected = Buffer.from(createJoinToken(sessionId, nickname));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
