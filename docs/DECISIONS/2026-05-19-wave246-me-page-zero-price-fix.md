# 2026-05-19 — Wave 246: /me 페이지 "번개 S급 시세 0원" 미스리딩 fix

## 결정

`/me` 페이지 / 운영자풀 / pack reveal 모달에서 시세 0원/null인 매물이
"번개 S급 시세 0원" 또는 "시세 0원" 으로 미스리딩 표시되는 lapse fix.

**사용자 명시 정책 (b)**: 0원 시 "표시 안 함" 또는 sku_median fallback.
이번 wave는 표시 안 함 + 친화 라벨 "시세 확인중" 채택 (사용자 친화 우선).

## 발견 (Audit)

### 사례 (pid 406974440)
- Apple Watch SE 2nd gen
- listing_price = 200,000
- DB `mvp_listings.sku_median` = 192,500 (band-agnostic)
- 시세표 정상 (150~230K, condition별 분리)
- 결과 (이전): "번개 S급 시세 0원" 표시

### Root cause
1. **`mvp/src/lib/candidates.ts:103-104` clamp** — `Math.max(0, sku_median - listing_price)`
   매입가 > sku_median 이면 `gross_resell_gap` = 0. 이번 wave에서는 clamp 유지 (별도 wave 대상).
2. **`marketSourceBadge`** (pack-reveal-modal.tsx:264) — `conditionClass === "mint"` 만 보고
   `medianPrice` 가 0/null이어도 "번개 S급" 배지 반환.
3. **admin-pool-browser.tsx:521** — `<span>· 시세 {krw(item.skuMedian)}</span>` 가드 X.
   16% pool 매물 (82/500 측정)에 sku_median=0 → "시세 0원" 직접 노출.
4. **dashboard.tsx:404** — landing demo alert preview 가드 X (사용자 노출 적지만 정합성).

## 변경 (What)

### pack-reveal-modal.tsx (commit e766846 — velocity P0 wave 와 같이 들어감)
- `marketSourceBadge` 에 `medianPrice > 0` 가드 — 0/null이면 배지 자체 반환 X (defense-in-depth).
- 관련 매물 카드 (line 2693) `sourceBadge` 생성 시 `hasMedian` 가드.
- 메인 매물 줄 (line 2303) — `medianPrice && medianPrice > 0` 명시 + 0/null 시 "시세 확인중" 친화 라벨.

### admin-pool-browser.tsx
- line 521 — `skuMedian > 0` 가드. 0이면 "시세 확인중" amber chip 표시.
- line 635 — 출처 배지 (다나와/번개 S급/번개 중고 매물 median) — `skuMedian > 0` 일 때만 표시.

### user-reveal-dashboard.tsx
- line 1402 — 기존 `medianPrice > 0` 가드 유지. terminal 아닌 카드에서 0/null 이면 "시세 확인중" chip 추가
  (이전: 그냥 빈 줄, 사용자가 데이터 누락인지 모름).
- terminal 카드는 별도 tombstone 가서 영향 X.

### dashboard.tsx (landing demo)
- line 404 — `item.skuMedian > 0` 면 가격, 아니면 "확인중".

## 메모리 정책 일치

- ✅ **3 화면 다 적용** (memory `ui_changes_apply_to_all_card_screens`) — admin-pool-browser + pack-reveal-modal + user-reveal-dashboard 모두 박음.
- ✅ **사용자 친화** (memory `project_core_principle_consumer_friendly`) — "시세 확인중" 친화 라벨, title 에 "표본 부족 또는 갱신중 — 차익은 추정치" 설명.
- ✅ **비파괴** (memory `feedback_destructive_actions_require_explicit_confirm`) — UI/clamp only, DB 변경 X.
- ✅ **decision log** (memory `feedback_decision_log_required`) — 본 문서.

## 후속 (Follow-up)

### 별도 wave 후보 (오늘 박지 않음 — 영향 큼)
1. **`candidates.ts:103-104` clamp 정책 재검토** — Option 1 (유지 + UI 가드 — 현재), Option 2 (negative 허용 → "차익 -22K"), Option 3 (pool 진입 전 차단). 사용자 의도는 이미 pool 진입한 매물에서만 fix (사후) — pool 차단은 별도 wave.
2. **Pool API band-aware sku_median fetch** — 현재 `mvp_listings.sku_median` 은 band-agnostic.
   `mvp_market_price_daily` 에서 condition_class 별 row 사용하면 mint 매물에 mint median 표시 가능.
3. **`mvp_listings.sku_median` recompute** — 16% 매물이 0인 이유 분석 후 backfill.

## 관련

- 사용자 path 선택 (b): 0원 시 표시 안 함 또는 sku_median fallback.
- 이번 wave 채택: "표시 안 함" + 친화 라벨 "시세 확인중" (사용자 친화 우선).
- 관련 commit:
  - `e766846` (velocity P0 fix) — pack-reveal-modal Wave 246 부분 같이 들어감.
  - 현재 wave 새 commit — admin-pool-browser + user-reveal-dashboard + dashboard 박음.
