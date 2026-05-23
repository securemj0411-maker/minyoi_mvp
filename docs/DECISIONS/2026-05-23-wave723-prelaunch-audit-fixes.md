## Wave 723 — 오픈전 종합 audit + 명확한 fix 3개 (실제 진행 2개)

- 시간: 2026-05-23 KST
- 발견: 4개 영역 병렬 sub-agent audit (UI 일관성 / 신발·의류 readiness / UX flow / 보안 운영). 입문자 신발·의류 진입 시점 기준.

### 진행한 변경

#### 1. 다크모드 `--brand-accent` 토스 블루 통일
- 파일: [src/app/globals.css:33-45](../../src/app/globals.css#L33)
- 발견: light tone `--brand-accent: #3182f6` (토스 블루) vs dark tone `#7a9580` (회색-녹색) → 다크모드에서 nav/CTA 톤 깨짐. Wave 718에서 nav 로고 emerald→blue 했지만 다크모드에선 무효였음.
- 변경:
  - `--brand-accent: #7a9580` → `#3b82f6` (Tailwind blue-500)
  - `--brand-accent-strong: #d4ddd6` → `#60a5fa` (blue-400)
  - `--brand-accent-soft: #1f2a23` → `#1e3a8a` (blue-900, dark hover bg)
- 위험: 89곳 `var(--brand-*)` 사용처에 일괄 적용. 다크모드 contrast 확인 필요 (light blue text on dark bg 가독성).

#### 2. user-reveal-dashboard 빈 상태 CTA dead-link fix
- 파일: [src/components/user-reveal-dashboard.tsx:1798-1804](../../src/components/user-reveal-dashboard.tsx#L1798)
- 발견: CTA `/me?tab=explore` → `me-dashboard-client.tsx:85` `VALID_VIEWS`는 `view=` 쿼리만 인식. `tab=`은 무시 → 같은 화면 reload (dead-end).
- 변경: `/me?tab=explore` → `/me?view=history` (Wave 343: history view = ExploreClient freemium 30개 풀). CTA 색도 `bg-emerald-600` → `bg-blue-600`으로 토스 톤 통일.
- 주의: `UserRevealDashboard` 컴포넌트 자체는 Wave 343에서 폐기 (import 0건). 사용자가 이 CTA 실제로 볼 일 없음 — dead code 청소 의미. 실제 빈 상태 UX는 `explore-client.tsx:2334` "이번 30개 풀에 해당 카테고리 매물이 없어요"가 살아있음.

### 진행 안 한 fix (정정)

#### `pool/analysis details` 누출 — **이미 안전 (Agent 4 오인)**
- 파일: [src/app/api/packs/pool/analysis/route.ts:161-164](../../src/app/api/packs/pool/analysis/route.ts#L161)
- Audit agent가 "라인 160 `details: message` 제거 필요"라 했지만 실제 코드는 이미 `error: "analysis_load_failed"` generic. `message`는 `console.error`에만 남고 response엔 안 새 나감.
- 전체 `src/app/api/**` grep으로도 `details: message`/`details: err` 0건. 보안 audit follow-up 항목 (memory 권고)도 현재는 OK.

#### Wave 714 condition grading deploy — **이미 main 반영**
- main commit log에 Wave 714a~t 전부 + 715~722 후속 commit까지 다 들어가있음 (`git log | grep wave.71`).
- Agent 2 보고는 `docs/DECISIONS/2026-05-23-wave714-condition-grading-shoe.md:147` "current branch: claude/amazing-agnesi-381a16 (worktree)" 문구를 outdated context로 가져온 false alarm.
- 실제 신발/의류 condition_tier 채움 %는 DB에서 별도 측정 필요 (이번 audit 범위 밖).

### 검증
- 단일 className/text 변경 2건, lint/type 영향 없음.
- 다른 세션이 `pack-reveal-modal.tsx` 480줄 추가 중 (launch-78 신발/의류 D급/A급 라벨 mismatch fix) — 충돌 방지 위해 해당 파일 미터치.

### 다음 (사용자 결정 필요)
- Beta 배지 emerald 잔존 (`app-nav.tsx:365`) — 로고만 blue 했음
- admin-pool-browser 카드 emerald 강조 (3화면 통일 원칙 위반)
- error.tsx digest raw 노출 입문자 UX
- 팩 오픈 fake progress 30~60초 뻗음 UX
- 모바일 dashboard sidebar 숨김
- Supabase 영문 에러 메시지 한글화 매핑 테이블
- 빈 카테고리 UX 정책 (narrow lane만 통과 카테고리에 안내 추가 여부)
- Wave 714 condition_tier DB 채움 % 측정
