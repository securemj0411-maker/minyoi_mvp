## Wave 725 — error.tsx digest 입문자 친화 toggle + 버튼 토스 블루 통일

- 시간: 2026-05-23 KST
- 발견: Wave 723 audit. `error.tsx:30-34` + `global-error.tsx:30-33` 가 `error.digest` (Next.js anonymous hash) 를 "오류 코드: 1234567890abc" monospace 폰트로 raw 노출 → 입문자에겐 무서운 텍스트. digest 는 운영자가 Vercel/Supabase 로그 매칭용 internal 추적 코드이며 사용자가 할 수 있는 행동 X. console.error 에 이미 박혀있어 UI 노출 불필요.

### 변경

#### 1. [src/app/error.tsx](../../src/app/error.tsx)
- digest 를 `<details>` toggle 로 숨김. summary "기술 정보 (운영자 문의 시 사용)" 로 라벨 — 평소엔 숨고, CS 문의 시 사용자가 펼쳐서 복사 가능.
- "다시 시도" 버튼: `bg-emerald-600 hover:bg-emerald-700` → `bg-blue-600 hover:bg-blue-700` (Wave 718/719 토스 블루 통일 흐름).

#### 2. [src/app/global-error.tsx](../../src/app/global-error.tsx)
- root-level 에러 (error.tsx 가 처리 못 하는 layout 자체 에러). inline style 만 쓸 수 있어 details/summary 도 inline 으로 박음.
- 동일한 toggle 패턴 + reset 버튼 색 `#314238` (짙은 녹색-회색) → `#2563eb` (blue-600).
- reset 버튼 marginTop 24 가 details 와 인라인으로 충돌하던 부분 `<div>` 로 감싸 줄바꿈 명확히.

### 검증
- `npx tsc --noEmit` — error.tsx / global-error.tsx 0 error.
- digest 가 없는 case 는 이전과 동일 (toggle 자체 미렌더). 동작 회귀 0.

### 위험
- `<details>` 는 모든 모던 브라우저 지원 (iOS Safari 6+, Chrome/Edge/Firefox 모두 OK). 입문자 모바일 환경에서 펼침 인터랙션 자연스러움.
- global-error 는 root-level 에러라 거의 발생 안 함. inline style details 가 의도대로 렌더되는지는 실측정 없음 — 일반 `<details>` 브라우저 default 스타일에 의존.

### 다음 (남은 wave 723 audit follow-up)
- 팩 오픈 fake progress — **사용자 결정: 카드 뽑기 UI 폐기 상태라 dead code, 별도 정리 wave**
- 모바일 dashboard sidebar 숨김
- Beta 배지 + admin-pool 카드 emerald 잔재
- 신발 condition_tier DB 채움 % 측정
