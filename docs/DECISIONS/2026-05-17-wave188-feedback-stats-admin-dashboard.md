# Wave 188 — 운영자 신고 카테고리 dashboard

## 컨텍스트

Wave 182c (정보 오류 신고) + Wave 185 (사용자 가시화) 박은 뒤 — 운영자 측 인사이트 빠짐:
- 어떤 카테고리 신고 많은지 → 시스템 보정 우선순위 결정
- 어떤 매물에 신고 몰리는지 → systemic issue 신호 (시세/parser 보정 trigger)
- 응답률 / 보정률 → 운영자 SOP 효율 측정

## 박은 것

### 1. API — `/api/admin/inaccurate-stats` (GET)

`mvp_reveal_feedback` (feedback_type='inaccurate_report') 최근 5,000건 fetch → 클라이언트에서 group.

#### note prefix 카테고리 추출
Wave 182c 박은 패턴 `[카테고리 라벨] ...` 에서 regex 추출:
```ts
const match = /^\[([^\]]+)\]/.exec(note);
// label → key 역매핑 (price/info/sold/fake_price/other/unknown)
```

#### 응답 구조
- `allTime` / `thisMonth` / `thisWeek` 3 기간
  - `total`, `totalTokens`
  - `byCategory[]`: 카테고리 × 상태 매트릭스 (pending/resolved/dismissed)
  - `byStatus`: 상태별 총합
  - `responseRate`, `resolveRate`: SOP 효율 측정
- `topPids[]`: 2회 이상 신고된 매물 top 20 (systemic 신호)
  - count + categories[] + statuses[] + listing meta (썸네일/이름/가격)
- `sampleSize`, `categoryMeta`

### 2. 페이지 — `/cau~~/feedback-stats`

- `page.tsx`: server component, admin auth 이중 보호
- `feedback-stats-client.tsx`: client-side UI

#### UI 구성
1. **기간 필터**: 최근 7일 / 이번 달 / 전체
2. **KPI 카드 4개**: 총 신고 / ✅ 보정 (보정률) / ⏳ 대기 (응답률) / 🪙 토큰 지급
3. **카테고리별 분포**: bar chart + 상태별 분해 (pending/resolved/dismissed)
4. **🚨 자주 신고 받는 매물**: 2회+ 신고 매물 list — 썸네일 + 카테고리 chip + 번장 link

#### 카테고리 색상 (UI 일관성)
- price (시세 부정확): rose
- info (매물 정보 다름): amber
- sold (이미 판매됨): zinc
- fake_price (가짜 가격 의심): purple
- other: sky
- unknown: zinc (분류 불가)

### 3. 운영자 nav 3 페이지 통일

- `/cau~~` (회원 목록)
- `/cau~~/loss-reports` (사용자 신고 검수)
- `/cau~~/feedback-stats` ← **새**

각 페이지 상단 nav 박힘. 현재 페이지는 chip 강조.

## 운영 SOP

### 카테고리별 보정 가이드
- **price (시세 부정확)** → `mvp_market_price_daily` 의 sample/confidence 점검 + candidate-pool-builder fallback 검토
- **info (매물 정보 다름)** → parser regex 보정 + catalog SKU 보정 wave
- **sold (이미 판매됨)** → tick-pipeline `listing_state` 동기화 빈도 ↑
- **fake_price (가짜 가격 의심)** → risk_keyword 강화 + AI L2 escrow 강제
- **other** → note 보고 분류 추가 가능성 검토

### topPids 활용
- 2회 이상 신고된 매물 → 시스템 issue 신호
- 특정 SKU 에 몰리면 → 그 SKU 의 시세 / parser / catalog 우선 보정
- 같은 카테고리 반복 → 시스템 측 fix 우선순위 ↑

## Trade-off

### Pros
- 운영자 인사이트 즉시 가시화 — Wave 182c + 185 데이터 가치 발현
- systemic issue 자동 감지 (topPids 2회+ filter)
- 기간별 trend 추적 가능
- 카테고리 × 상태 매트릭스로 SOP 효율 측정

### Cons
- note prefix 파싱 — 사용자 신고 시 카테고리 prefix 안 박힌 경우 "unknown" 분류 (Wave 182c API 에서 자동 박힘 → 정상 케이스는 OK, 직접 SQL INSERT 시만 unknown)
- 5,000건 limit — 사용자 base 커지면 sliding window 또는 pagination 필요
- group_by 클라이언트 — DB level aggregation 안 사용 (PostgREST 한계)

## Test

`npm run test:core`: **369/370 pass** (1 skipped, 0 fail).

## Follow-up

1. **DB level aggregation** — sample 5,000건 넘어가면 RPC 또는 view 사용
2. **sliding window**: 30일 / 90일 추이 chart
3. **카테고리 trigger 자동화** — price 신고 N건 누적 시 자동 wave 생성 (cron + slack 알림)
4. **신고자별 통계** — 자주 신고하는 사용자 top 10 (advocate 후보)

## Linked

- `2026-05-17-wave182c-inaccurate-report-instead-of-loss-report.md`
- `2026-05-17-wave185-feedback-activity-visibility.md`
