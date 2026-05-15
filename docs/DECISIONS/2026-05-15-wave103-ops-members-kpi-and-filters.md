# Wave 103 — 운영자 회원 페이지에 KPI 카드 + 검색/필터 추가

> Status: **applied (code).** owner 자율 권한 "구상해서 넣어봐". 운영자가 한 화면에서 수익/활동/회원 검색을 한 번에 처리하도록.

CLAUDE.md 6 필드 포맷.

## 1. KPI 카드 8개 — 상단 dashboard

- 시간: 2026-05-15
- 발견: owner 요청 — 운영자 페이지에 회원 목록 외에 일상적 모니터링 metric 필요. 회원 수 늘어나면 검색/필터도 필수.
- 변경: **[mvp/src/app/cauleex.../page.tsx](mvp/src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/page.tsx)**
  - KST timezone-aware `kstTodayStartIso()` / `kstMonthStartIso()` 헬퍼 추가 (Asia/Seoul 자정 정확히 ISO 변환).
  - `countRows(table, filter)` PostgREST count util 추가 (Prefer: count=exact).
  - Promise.all 추가 fetch 3개: pack opens / reveals / link clicks today.
  - In-memory aggregate: revenueToday, revenueMonth, activeSubs, newSignupsToday.
  - 신규 `<KpiCard>` server component (label + value + sub + accent 색상).
  - **표시 KPI 8개**:
    1. 오늘 매출 (₩) — `sum(last_payment_amount)` where `last_payment_at >= KST today` (amber)
    2. 이번달 매출 (₩) — KST 월초 기준 (amber)
    3. 활성 구독자 — `status=active AND plan_key != free`, sub: Pro/Plus/Starter breakdown (emerald)
    4. 오늘 신규 가입 — `auth.users.created_at >= KST today` (rose)
    5. 오늘 팩 열기 — `mvp_pack_opens` where `opened_at >= today AND result=success` (sky)
    6. 오늘 공개 — `mvp_pack_reveals` where `revealed_at >= today` (sky)
    7. 오늘 번개장터 클릭 — `link_clicked_at >= today`, sub: CTR % (sky)
    8. 베타 체험단 수, sub: 최근 7일 로그인 수 (purple)
  - 2×4 grid (mobile 2열, md 4열).
- 검증: tsc clean.
- 위험: 낮음.
  - 매출 정확성 caveat: `mvp_user_plans.last_payment_at`는 user당 1개 (최신 결제). 같은 user가 한 달 안에 여러 번 결제 시 마지막 것만 카운트. 정확한 누적 매출은 별도 결제 history table 필요. **현재 metric은 "마지막 결제 기준" — 신규 결제 위주 측정에 적합, 누적 매출에는 부적합.**
  - Vercel cold start 시 fetch 3개 추가 (~500ms). 페이지 로드 1~1.5s 예상.
- 다음:
  - 정확한 누적 매출 필요하면 `mvp_payment_history` 테이블 신설 검토 (별도 wave).
  - 주간/월간 차트 (활성도 추세) — owner 요청 시 추가.

## 2. 검색 + 플랜/베타 필터 — 회원 테이블

- 시간: 2026-05-15
- 발견: 회원 수 늘어나면 특정 회원/플랜 찾기 어려움. 베타 체험단만 보기, Pro만 보기 등 필터 필요.
- 변경: **[mvp/src/app/cauleex.../members-table.tsx](mvp/src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/members-table.tsx)**
  - state 3개 추가: `search`, `planFilter` (all/free/starter/plus/pro), `betaFilter` (all/beta/non-beta).
  - `filteredRows` derived state — `email + nickname` substring match + plan filter + beta filter.
  - UI:
    - 검색 input (좌측, sm:max-w-xs)
    - 플랜 chip 5개 (선택 시 black/white 강조)
    - 베타 chip 3개 (선택 시 purple)
    - 표시 카운트 "X건 표시 (전체 Y)"
  - rows.map → filteredRows.map (테이블 본체).
- 검증: tsc clean.
- 위험: 매우 낮음. client-side filter — 페이지 reload 없음.
- 다음:
  - 회원 200+ 넘으면 server-side pagination + search query 마이그레이션 검토.
  - 추가 정렬 (가입일순 / 매출순 / 마지막 로그인순)은 다음 wave.

## 3. 거론 금지

- 별도 dashboard 페이지 신설 (/cauleex.../stats 등) — 한 페이지에 통합 우선.
- 차트 라이브러리 (recharts/chart.js) 추가 — KPI 카드로 충분. 필요 시 별도 wave.
- 실시간 update (websocket) — owner 직접 새로고침으로 충분.
- 누적 매출 정확 계산 — `mvp_payment_history` 테이블 없음 (별도 wave 필요 시).
