# Wave 803f — daangn mixed fallback 박힐 때 DB sku_median 우선

## 사용자 보고 + 결정

> "그냥 재파싱이 안된거아님?? 2번은 1번을 근본 차단하면 벌어지지 않을 일인데 뭐지?"
> 옵션 A: marketBasis 박을 때 옛 sku_median 박음 (일관성)

## 진단 — 사용자 본인 박은 두 정책 충돌

| 정책 | 위치 | 내용 |
|---|---|---|
| Wave 897 | tick-pipeline.ts:6989 | daangn + per-source sample<3 → sku_median 0 → 차단 |
| Wave 887 | pack-open.ts:1303 | daangn + per-source sample≥3 → 당근 기준, 부족 → mixed fallback + `sourceFallbackUsed` 라벨 |
| Pool ready floor | tick-pipeline.ts:4818-4849 | ready 매물 수 < threshold → invalidation defer (throughput 보호) |

### Acne 셔츠 흐름 (모순 발생)

1. score-worker 박힌 시점 (last_verified_at) → daangn per-source sample 3+ → sku_median **184k** 박음 → ready
2. 지금 → daangn per-source sample=2 (시세 갱신, 다른 매물 expire)
3. score-worker re-run → sku_median 0 박으려 함 (Wave 897)
4. Pool ready floor 박혀서 **invalidation defer** → 옛 sku_median 184k 유지
5. detail-access 박은 marketBasis = **real-time mixed fallback 230k** (Wave 887 — bunjang clean dominant)
6. → 사용자 화면: 시세 230k, 비교 매물 daangn 200/67/65k (모순)

## Fix

`detail-access:recomputeExactPoolItemProfit`:

```typescript
const effectiveMedianPrice = isDaangnMarketplaceSource(item.marketplaceSource)
  && marketBasis.sourceFallbackUsed
  && item.skuMedian && item.skuMedian > 0
  ? item.skuMedian
  : marketBasis.medianPrice;
```

→ daangn + mixed fallback 박혀있고 DB sku_median 박혀있으면 그것 박음 (real-time mixed 230k 박지 X).

## 효과

| Acne 셔츠 | Before | After |
|---|---|---|
| DB sku_median | 184k | 184k (불변) |
| marketBasis.medianPrice (real-time) | 230k (mixed fallback) | 230k (불변) |
| 사용자 본 시세 | **230k** (mixed) | **184k** (DB sku_median) ✓ |
| 비교 매물 일관성 | ❌ 시세 230k > 비교 매물 max 200k | ✅ 시세 184k ≈ 비교 매물 |
| ready 박힘 | ready (floor defer) | ready (floor defer 그대로) |

## 비파괴

- `bunjang/joongna` 변화 X (`!isDaangn`)
- daangn + per-source sample ≥ 3 (`sourceFallbackUsed=false`) → 변화 X
- 차단 조건 (`sampleCount < 3`) 그대로
- score-worker / candidate-pool-builder / ready floor 정책 그대로

## Wave 803c 와 차이

| | Wave 803c (revert) | Wave 803f |
|---|---|---|
| 박는 곳 | `pool/route.ts:sourceAwareMedian` | `detail-access:recomputeExactPoolItemProfit` |
| 박은 거 | threshold `< 3` → `< 2` (정책 위반) | DB sku_median override (정책 안 박음) |
| 사용자 정책 | **위반** | **유지** (Wave 887 sourceFallbackUsed 활용) |

## Trade-off

- ⚠️ DB sku_median 옛 박힌 거 박음 → 약간 stale 가능 (며칠 박혀있는 매물)
- ✅ real-time mixed fallback (다른 source) 박는 것보다 일관성 우선
- ✅ Wave 887 박을 때 박은 `sourceFallbackUsed` 라벨 활용 (이미 박혀있는 데이터)
- ✅ 사용자 정책 안 깸 (sample 3 정책 유지)

## What Not To Do

- `sourceAwareMedian` threshold 박지 X (Wave 803c 박은 거 = 정책 위반)
- ready floor 정책 박지 X (사용자 본인 박은 throughput 보호)
- score-worker logic 박지 X (Wave 897 박은 거 그대로)
- mixed fallback 자체 박지 X (Wave 887 박은 거 그대로)
- 박은 거 한 곳 (detail-access) 만 — pool/route.ts marketBasis 박는 곳 박지 X (사용자 본 reveal 시점 시세 박는 게 detail-access)

## 향후 권장 (사용자 결정 박을 때)

- **재파싱 박는 cron 주기 박은 거 확인** — 매물 sku_median 갱신 박는 빈도
- **stale 매물 우선순위 박는 cron** — last_verified_at 박은 시점 오래된 매물 우선 박음
- 또는 **ready floor threshold 박는 거 박을지** — 무한 defer 박힌 매물 ulimately invalidate

## 검증

배포 후:
1. Acne 셔츠 (`9002503803331`) reveal → 시세 **184k** 박힘 (이전 230k)
2. 비교 매물 (daangn 200/67/65k) 와 가까운 거리 (184k median ~ 비교 매물 110k 평균)
3. 다른 daangn + per-source sample≥3 매물 → 변화 X
4. bunjang/joongna 매물 → 변화 X

## 복원 가이드

문제 발생 시 1줄 revert:
```diff
- const effectiveMedianPrice = isDaangnMarketplaceSource(item.marketplaceSource)
-   && marketBasis.sourceFallbackUsed
-   && item.skuMedian && item.skuMedian > 0
-   ? item.skuMedian
-   : marketBasis.medianPrice;
+ const effectiveMedianPrice = marketBasis.medianPrice;
```

## 관련 commits / PRs

- PR #51 — Wave 803f
- 영향받은 wave: Wave 887 (sourceFallbackUsed 라벨), Wave 897 (daangn mixed fallback 차단), Pool ready floor

## Related Waves

- Wave 887 — daangn 매물 sample 충분 시 당근 기준 시세 (sourceFallbackUsed 라벨)
- Wave 897 — daangn local execution market — mixed fallback 차익 계산 금지
- Wave 803c — REVERT (정책 위반 박았던 거)
- Wave 803d — 상세보기 모달 위치 박음
- Wave 803e — Wave 803c revert
- **Wave 803f (now)** — daangn mixed fallback 박힐 때 DB sku_median 우선
