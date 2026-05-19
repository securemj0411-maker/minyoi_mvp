# Wave 249 — candidate-pool-builder clamp Option 3 (pool 진입 차단)

- date: 2026-05-19
- type: pool builder gate (additive only — DB 변경 X)
- scope: `mvp/src/lib/candidate-pool-builder.ts`
- branch: `fix/market-chart-honesty-2026-05-19`
- follow-up: Wave 247.2 (pool API band-aware sku_median fallback)

## 배경

Wave 246 `me` 페이지 0원 시세 UI fix + Wave 247.2 band-aware sku_median fallback 으로 production pool 의 `sku_median=0` 비율 16% → 0% 까지 감소 (Wave 247.2 SQL 측정).

남은 정책 결정: `mvp/src/lib/candidates.ts:103-104` 의 `Math.max(0, sku_median - price)` clamp.

3 옵션 — 사용자 결정 Option 3:
- ~~Option 1: clamp 유지 — 음수 차익 = display 0~~
- ~~Option 2: clamp 제거 — negative 허용 표시~~
- **Option 3: candidate-pool-builder 단계 차익 음수 + sku_median=0 매물 pool 진입 차단 (root fix).**

근거:
- 미뇨이 핵심 = 차익 매물 추천. 차익 음수 자명히 추천 X.
- 일반인 친화 (memory `project_core_principle_consumer_friendly`) — 차익 음수 추천 시 혼란.
- 시세 sample 정확 — 차익 음수 매물 비교군 제외.
- Wave 246 root cause — pool 자체 차단 시 UI clamp 가 fallback 일 뿐 main path X.

## 구현

### `mvp/src/lib/candidate-pool-builder.ts` — `bandFromProfit` 직전 두 가드 추가

```ts
// 1) sku_median_unavailable (skuMedian = 0/null/NaN/<=0)
if (row.skuMedian == null || !Number.isFinite(row.skuMedian) || row.skuMedian <= 0) {
  skipped += 1;
  invalidations.push({ pid, reason: "sku_median_unavailable" });
  continue;
}

// 2) negative_resell_gap (price >= skuMedian, price > 0)
if (Number.isFinite(row.price) && row.price > 0 && row.price >= row.skuMedian) {
  skipped += 1;
  invalidations.push({ pid, reason: "negative_resell_gap" });
  continue;
}
```

**순서**: `sku_median_unavailable` 가 `negative_resell_gap` 앞 — "비교 불가능 신호" 가 더 정확.

### `candidates.ts:103-104` 옵션 A 유지 (defense in depth)

```ts
grossResellGap: shipping?.gross_resell_gap ?? Math.max(0, item.sku_median - item.price),
netGapAfterShipping: shipping?.net_gap_after_buy_shipping ?? Math.max(0, item.sku_median - item.price),
```

→ 변경 X. root fix 가 pool builder 에서 처리됨. clamp 는 외부 시점에 통과한 매물의 안전망 (이미 차단된 매물 도달 X).

## 효과 — invalidation reason 분리

### 기존 (Wave 248 이전):
- `profit_below_pack_band` 1043건 — 차익 음수 + sku_median 부재 + 작은 차익 모두 하나로 묶임.

### 신규 (Wave 249):
- `sku_median_unavailable` — Wave 247.2 band-aware fallback 이 못 채운 매물.
- `negative_resell_gap` — 차익 음수/0 매물 (사용자 친화 친절한 reason).
- `profit_below_pack_band` — 위 두 case 제외한 "차익 양수지만 작아서 band fail" 만 남음.

운영 가시성 ↑. 24h 측정 SQL 으로 각 reason 별 추세 확인 가능.

## 검증

### 1. unit test `tests/wave249-pool-builder-clamp-fix.test.ts` — 11/11 PASS:

`Wave 249 — sku_median_unavailable gate` (4)
- skuMedian=0 → 차단
- skuMedian=null → 차단
- skuMedian=NaN → 차단
- skuMedian=-1 → 차단

`Wave 249 — negative_resell_gap gate` (5)
- 차익 음수 (price=150K, skuMedian=100K) → 차단
- 차익 0 (price=100K, skuMedian=100K) → 차단 (>= check)
- 차익 양수 미세 → 통과 (negative_resell_gap gate 한정)
- 차익 양수 → pool 진입 정상
- price=0 → placeholder_price 가 먼저 잡음

`Wave 249 — gate 순서: sku_median_unavailable 우선` (1)
- skuMedian=0 + price>skuMedian → sku_median_unavailable 만 박힘

`Wave 249 — band-aware fallback 후 정상 매물 처리 (Wave 247.2 연동)` (1)
- band-aware fallback 으로 skuMedian 채워진 매물 → 정상 pool 진입

### 2. test:core 회귀: 582/590 pass

- 신규 Wave 249 test 11건 모두 pass.
- 잔여 8건 fail = pre-existing `/me` UI contract tests (Wave 247.2 decision log 에서도 같은 8건 — 본 wave 영향 X).
- 기타 pool-builder 관련 test (Wave 132/137/138/141/145/148/151/152/core-rules) 모두 pass.

### 3. SQL baseline 측정 (Wave 247.2 적용 후 현재)

`SELECT total, zero_sku_median, price_gte_market FROM mvp_candidate_pool WHERE status='ready' (439 ready)`:
- total: 439
- zero_sku_median: 0 (0%) — Wave 247.2 효과 확인
- price_gte_market (broad SKU 기준): 3 (0.68%)

위 3건 모두 `condition_class=unopened` + 양수 `expected_profit_min/max` — band-aware skuMedian (referencePrice) 적용 시 실제 차익 양수. 즉 broad `mvp_listings.sku_median` 만 보면 음수처럼 보이지만 pool builder 시점의 band-aware skuMedian 기준 정상. Wave 249 의 `negative_resell_gap` gate 는 이 케이스를 false positive 로 차단하지 X (pool builder 의 `row.skuMedian` 가 이미 band-aware).

baseline invalidation reason (24h):
- profit_below_pack_band: 1043
- lifecycle_state_missing_suspect: 82
- blocked_deep_discount_review: 67
- (기타 작은 reason 들)

→ Wave 249 적용 후 24h 측정 시 `profit_below_pack_band` 큰 덩어리 일부가 `sku_median_unavailable` / `negative_resell_gap` 으로 분리됨 예상.

## 24h 후속 측정 SQL

```sql
SELECT
  status,
  invalidated_reason,
  COUNT(*) AS n,
  COUNT(*) FILTER (WHERE invalidated_reason = 'negative_resell_gap') AS negative_gap,
  COUNT(*) FILTER (WHERE invalidated_reason = 'sku_median_unavailable') AS no_median
FROM mvp_candidate_pool
WHERE updated_at >= now() - interval '24 hours'
GROUP BY status, invalidated_reason
ORDER BY n DESC;
```

비교 지표:
- baseline (Wave 247.2 후): `profit_below_pack_band` 1043.
- Wave 249 후 (예상): `profit_below_pack_band` 감소 + `negative_resell_gap` / `sku_median_unavailable` 분리.

## 정책 준수

- additive only — DB 변경 X. 새 migration / 새 column X.
- 사용자 비파괴 정책 (memory `feedback_destructive_actions_require_explicit_confirm`) — DB UPDATE/DROP X.
- 일반인 친화 (memory `project_core_principle_consumer_friendly`) — pool builder 차단으로 사용자 화면에 차익 음수 매물 노출 X.
- 3 화면 정책 (memory `feedback_ui_changes_apply_to_all_card_screens`) — invalidation 은 backend, UI 변경 X. 세 화면 (admin-pool-browser / pack-reveal-modal / user-reveal-dashboard) 모두 자동 적용.
- decision log (memory `feedback_decision_log_required`) — 본 파일.

## admin UI badge (관찰 — 추가 작업 없음)

기존 admin UI (`/admin/pool-browser`, `/admin/classification-listings`) 가 `invalidated_reason` 표시하면 신규 reason 두 개 자동 표시. badge label 한국어 매핑은 후속 별도 wave 에서 (사용자 친화 부분).

## 후속 (별개 wave)

- 24h shadow audit telegram alert → 별도 wave (이 작업 끊지 X).
- 별도 wave 가능: admin UI 의 reason 한국어 label 매핑 (`sku_median_unavailable` → "시세 데이터 부족", `negative_resell_gap` → "차익 음수").
