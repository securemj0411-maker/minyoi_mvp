# launch-108 — admin SPA shell: layout + sticky AdminTopBar + 영문화

**Date**: 2026-05-24
**Owner**: caulee
**Scope**: cau 운영자 디렉토리를 SPA-feel 로 — sticky top bar + soft navigation + 일관 영문 톤

## 배경

기존 cau 페이지들:
- 각 sub-page (`page.tsx`, `pool/`, `loss-reports/`, `feedback-stats/`, `detail-events/`) 가 자체 nav + 헤더 + KPI ticker 박음.
- nav 클릭 시 풀 페이지 reload → 정적 느낌.
- 한국어 라벨 ("회원 목록", "사용자 신고 검수", "신고 통계", "상세 행동") + 영문 nav 칩 섞임 → 톤 불일치.
- 사용자 frustration: "리액트처럼 웹앱 느낌 안 나냐, 블룸버그 톤 살려라, 한국어 쓰지 마라".

## 변경

### 신설 (3개 파일)

**`/cau../layout.tsx`** (server):
- admin auth 1회 (`requireSupabaseUserFromCookies` + `isAdminUser` + `notFound()`).
- 모든 cau 페이지에서 admin auth 코드 제거.
- `AdminTopBar` 마운트.

**`/cau../admin-top-bar.tsx`** (client) — sticky 3-row:
- **Row 1**: `▌MINYOI TERM v1.0 · ●LIVE` + KST clock (1s tick) + `◀ MAIN` 링크.
- **Row 2**: KPI ticker 8셀 (REV TODAY/MONTH, ACTIVE SUB, ACCOUNTS, NEW SIGNUP, PACK OPEN, REVEAL, CLICK·CTR) — `/api/admin/stats` 30s polling.
- **Row 3**: nav `MEMBERS / POOL / REPORTS / STATS / EVENTS` — Next.js `<Link prefetch>` + `usePathname()` active highlight (▶ prefix + amber border).

**`/api/admin/stats/route.ts`**:
- 기존 cau page.tsx 의 KPI server fetch 코드 추출.
- client polling 용 JSON 반환 (revenueToday/Month, activeSubs, totalPro/Plus/Starter, newSignupsToday, packOpensToday, revealsToday, clicksToday, totalAccounts, computedAt).
- admin auth + 403 가드.

### 정리 (5개 페이지)

각 페이지에서 nav/헤더/KPI 코드 제거. 본문만 + 영문 헤더:
- `page.tsx` (MEMBERS): `▌MEMBERS / OPERATORS` — ManualDepositPanel + FeedbackPanel + MembersTable.
- `pool/page.tsx`: `▌POOL BROWSER` — AdminPoolBrowser.
- `loss-reports/page.tsx`: `▌FEEDBACK QUEUE` — FeedbackReviewFull.
- `feedback-stats/page.tsx`: `▌FEEDBACK STATS` — FeedbackStatsClient.
- `detail-events/page.tsx`: `▌DETAIL EVENTS` — 기존 내부 한국어 KpiCard 라벨 일단 keep (다음 wave 영문화).

## 효과

- **nav 클릭 시 sticky bar reload 안 됨** (Next.js App Router soft navigation + 공유 layout).
- **KPI 실시간 갱신** (30s polling, cron tick 주기 정합).
- **일관 영문 톤** + 블룸버그 터미널 느낌.
- 화면 위 항상 보이는 KPI ticker = 운영자 어디 있든 핵심 지표 항상 봄.

## 영향

- 운영자 UX 크게 개선 (페이지 전환 부드러움 + 실시간 데이터).
- admin auth 로직 5개 → 1개 (layout) 로 중복 제거.
- KPI fetch 부담: 5 pages × 1 fetch (페이지 마다) → 1 client × 30s polling. 운영자 1명만 봐도 매분 2회. 부담 적음.

## 남은 정리 (선택)

- `detail-events` 내부 KpiCard 라벨 (이벤트/사용자/세션/상세 열람/...) 영문화.
- `ManualDepositPanel` + `FeedbackPanel` 내부 한국어 라벨 영문화.
- (관리자 페이지인 만큼 영문 톤 전면 일관화 권장.)
