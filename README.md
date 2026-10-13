# 수업용 실시간 채팅 웹 (Classroom Live Chat)

> **30인 규모 수업 및 세미나 최적화 실시간 웹 채팅 서비스**  
> 학생은 로그인 없이 **QR 코드 스캔 및 닉네임 입력**만으로 3초 만에 입장하고, 강사는 **수업 열기/종료, 채팅 얼리기(음소거), 분탕 메시지 즉시 삭제**를 통해 수업 외 시간이나 불청객의 분탕을 완벽히 방지합니다.

---

## 주요 기능

1. **로그인 없는 3초 입장 (학생)**
   - 빔프로젝터에 띄워진 QR 코드를 카메라로 스캔하거나 6자리 PIN 코드 입력
   - 닉네임만 입력하고 즉시 입장 (개인정보 수집 X)
2. **수업 세션 수명 주기 제어 (분탕 원천 차단)**
   - 강사가 관리자 페이지(`/admin`)에서 **[새 수업 시작]**을 누를 때만 방이 열림
   - 수업 종료 시 **[수업 종료]**를 누르면 모든 학생의 입력창이 즉시 잠기며 이후 접속 차단
   - 다음 수업에는 완전히 새로운 QR 및 PIN이 발급되어 이전 링크로 접속 불가
3. **강사 제어 센터 (`/admin`)**
   - **대형 QR 코드 팝업 모드**: 빔프로젝터 투사용 전체화면 QR 지원
   - **채팅 일시 정지 (Mute/Freeze)**: 설명 중 학생 채팅창 일시 잠금
   - **분탕 메시지 삭제**: 클릭 한 번으로 문제 메시지 실시간 삭제
   - **강사 공지 전송**: 강사 공지 뱃지가 달린 강조 공지 발송
4. **모바일 최적화 반응형 UI**
   - 스마트폰, 태블릿, 노트북 어디서나 쾌적한 메신저 인터페이스

---

## 로컬 실행 방법

```bash
# 1. 패키지 설치
npm install

# 2. 로컬 개발 서버 실행
npm run dev
```

브라우저에서 접속:
- **학생 입장 화면**: `http://localhost:3000`
- **강사 제어 센터**: `http://localhost:3000/admin` (기본 비밀번호: `admin1234`)

> **로컬 테스트 팁:**  
> 한 브라우저 창에서는 `/admin`에 들어가서 [새 수업 시작하기]를 누르고, 다른 브라우저 창(또는 시크릿 창)에서 메인 페이지(`/`)로 들어가 닉네임을 적고 입장해 보세요. 창 간에 실시간으로 메시지와 세션 상태가 동기화됩니다.

---

## Vercel 배포 가이드

1. **GitHub 저장소에 코드 푸시**
2. **[Vercel](https://vercel.com) 로그인 후 "Add New Project" -> 해당 저장소 Import**
3. **환경 변수(Environment Variables) 등록 (선택/권장)**:
   - `ADMIN_PASSWORD`: 강사 관리자 비밀번호 (기본값: `admin1234`)
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL (대규모/영구 DB 연결 시)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase 익명 공개 키
4. **Deploy 클릭** -> 1분 내로 전 세계 무료 배포 완료

---

## 프로젝트 구조

```
chat-web/
├── src/
│   ├── app/
│   │   ├── page.tsx               # 학생 입장 페이지 (PIN & 닉네임)
│   │   ├── admin/page.tsx         # 강사용 제어 센터 (QR 발급 & 방 통제)
│   │   ├── chat/page.tsx          # 실시간 채팅방 화면
│   │   └── api/
│   │       ├── session/route.ts   # 세션 개설/종료/상태 API
│   │       └── messages/route.ts  # 메시지 송수신/삭제 API
│   ├── components/
│   │   └── QRCodeDisplay.tsx      # QR 코드 및 PIN 표시 컴포넌트
│   ├── hooks/
│   └── useRealtimeChat.ts         # 실시간 메시지/세션 구독 커스텀 훅
│   ├── lib/
│   │   ├── memoryStore.ts         # 인메모리/서버리스 세션 스토어
│   │   └── supabase.ts            # Supabase 클라이언트 설정
│   └── types/
│       └── chat.ts                # TypeScript 데이터 모델
├── supabase/
│   └── schema.sql                 # Supabase PostgreSQL DDL 스키마
└── CHAT_TECH_SPEC.md              # 상세 기술 스펙 문서
```
