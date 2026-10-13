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
