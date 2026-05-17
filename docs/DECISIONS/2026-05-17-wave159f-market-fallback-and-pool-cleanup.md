# Wave 159f — 시세 fallback chain fix + 풀 정합성 cleanup

- 시간: 2026-05-17 KST
- 사용자 코멘트 pid 408329098: "아이폰 14 다나와 새제품 아닌거같은데??? 제대로 보는 거 맞아??"

## 발견 (자동 사이클로 검출)

### 1. 풀 정합성 — listing_type ≠ normal 매물 13건 ready 상태 잔류
[Wave 159e](2026-05-17-wave159e) 박기 전 옛 코드 시점에 normal 분류된 매물이 풀에 그대로:
- unknown 12건 + buying 1건 = 13건 ready
- 일괄 invalidate (`invalidated_reason = 'wave159e_backfill_listing_type_mismatch'`)

### 2. **CRITICAL**: 시세 fallback chain 임의 condition 잡음
[tick-pipeline.ts:2017 `SCORE_CONDITION_FALLBACK`](mvp/src/lib/tick-pipeline.ts:2017):
- `unopened` 키 누락 — fallback 정의 없음
- `flawed: ["flawed", "all"]` / `low_batt: ["low_batt", "all"]` — fallback 짧음
- 마지막 fallback: `byCondition.values().next().value` (Map 첫 entry — **임의 condition**)

iPhone 14 매물 (pid 408329098) 사례:
- condition_class = `flawed` (리퍼 매물)
- mvp_market_price_daily 분포: clean ₩331K / low_batt ₩349K / normal ₩340K / **unopened ₩1,287K** (1건, 다나와 새 가격) / worn ₩400K
- SCORE_CONDITION_FALLBACK[flawed] = ["flawed", "all"] → 둘 다 없음 → 마지막 fallback이 임의 entry 잡음 → **unopened ₩1,287K 박힘**
- 결과: 매물 가격 ₩590K vs 시세 ₩1,250K → 차익 ₩660K (56% 마진) — 부풀려진 시세

## 변경 (tick-pipeline.ts)

### 1. SCORE_CONDITION_FALLBACK 보강
```typescript
const SCORE_CONDITION_FALLBACK: Record<string, string[]> = {
  unopened: ["unopened", "mint", "clean", "normal", "all"],  // ← 신규
  mint: ["mint", "clean", "normal", "all"],
  clean: ["clean", "normal", "mint", "all"],
  normal: ["normal", "clean", "worn", "all"],
  worn: ["worn", "normal", "all"],
  low_batt: ["low_batt", "worn", "normal", "all"],           // ← 보강 ["low_batt", "all"]
  flawed: ["flawed", "worn", "low_batt", "normal", "all"],   // ← 보강 ["flawed", "all"]
  all: ["all", "normal", "clean", "worn", "mint"],
};
```

### 2. 마지막 fallback 안전화
```typescript
// 이전: byCondition.values().next().value (임의 entry → unopened 잡힘 위험)
// 새: normal/worn/clean만 — unopened/mint 시세 절대 잡지 않음
return byCondition.get("normal") ?? byCondition.get("worn") ?? byCondition.get("clean") ?? undefined;
```

### 3. fashion-mobility 가방/자전거 정합성 검증
- 1,048건 모두 condition_class=normal (parser default)
- 511건이 bunjang_condition_label 보유 (backfill 영향 가능성)
- 단 fashion-mobility 본품 시세 비교 정확도 낮은 영역 (Wave 130 미구현) — 별도 wave 처리.

## 검증
- typecheck production clean.
- 영향: 코드 적용 이후 시세 재집계 시 flawed/low_batt/unopened 매물에 unopened 임의 fallback 불가.

## 위험
- **기존 박힌 시세 row**: mvp_market_price_daily 그대로. 이미 잘못 박힌 sku_median은 다음 market-worker tick에 재계산되어 정정됨.
- **pool 진입한 매물**: 위 13건 invalidate 외에도 시세 부풀려진 매물이 풀에 있을 수 있음. 코드 fix 후 score_dirty 재마킹 + 다음 tick에 재처리되며 자연 정정.

## 다음
- 24h 후 측정: condition_class별 sku_median 분포 + 부풀려진 시세 매물 잔류 수.
- pack-open.ts에도 동일 fallback chain 동기화 필요 검토 (pack-open의 selectMarketRowByCondition).
- iPhone 14 base SKU 외 다른 가전/태블릿/노트북 SKU도 fallback 잘못 박힐 가능성 일괄 재집계.
