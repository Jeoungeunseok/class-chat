-- 1. 수업 세션 관리 테이블 생성
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(100) DEFAULT '오늘의 실시간 수업',
    pin_code VARCHAR(6) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_chat_muted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE
);

-- 2. 메시지 테이블 생성
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    sender_name VARCHAR(30) NOT NULL,
    content TEXT NOT NULL,
    is_teacher BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at ASC);

-- 3. 익명 사용자(anon key) 읽기 및 쓰기 권한 허용 (RLS 정책)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access for sessions" ON sessions;
CREATE POLICY "Public access for sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for messages" ON messages;
CREATE POLICY "Public access for messages" ON messages FOR ALL USING (true) WITH CHECK (true);

-- 4. 실시간 웹소켓 구독 (Realtime) 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 5. 강사 자료 파일 첨부 (파일 업로드/다운로드 기능)
--    이미 1~4번을 실행한 프로젝트라면 이 5번 부분만 SQL Editor에서 실행하면 됩니다.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- 파일 저장소 버킷: 누구나 다운로드 가능(public), 업로드·삭제는 서버의 service role 키로만 가능
-- (서버가 처음 업로드할 때 자동으로 만들기도 하지만, 미리 만들어 두면 확실합니다)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('class-files', 'class-files', true, 52428800)
ON CONFLICT (id) DO NOTHING;
