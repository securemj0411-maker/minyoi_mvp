# Wave 159h — condition fallback shared module 통합 (DRY)

- 시간: 2026-05-17 KST

## 발견 (자동 사이클)

[Wave 159f/g](2026-05-17-wave159f) 박은 후 4곳에 동일 fallback chain 매핑 중복:
- `tick-pipeline.ts`
- `pack-open.ts`
- `landing-showcases.ts`
- `api/market/history/route.ts`
- `api/listings/[pid]/market-source/route.ts`

DRY 위반 → 미래 정책 변경 시 4-5곳 동시 수정 필요. 한 곳만 빠뜨려도 정합성 깨짐. Wave 159f→g 사이에 이미 이 사고 발생 (tick-pipeline fix가 다른 3곳에 동기화 안 됐던 사고).

## 변경

### 신규: `src/lib/condition-fallback.ts`
```typescript
export const CONDITION_FALLBACK_CHAIN: Record<string, string[]> = {
  unopened: ["unopened", "mint", "clean", "normal", "all"],
  mint: ["mint", "unopened", "clean", "normal", "all"],
  clean: ["clean", "normal", "mint", "all"],
  normal: ["normal", "clean", "worn", "all"],
  worn: ["worn", "normal", "all"],
  low_batt: ["low_batt", "worn", "normal", "all"],
  flawed: ["flawed", "worn", "low_batt", "normal", "all"],
  all: ["all", "normal", "clean", "worn", "mint"],
};

export const SAFE_FINAL_FALLBACK = ["normal", "worn", "clean"]; // unopened/mint 임의 잡지 않음

export function conditionFallbackChain(target): string[] { ... }
export function pickByConditionFallback<T>(byCondition, target, getSamples, minSamples=3): { row, conditionClass, fallbackUsed } { ... }
```

### refactor (5곳)
- `tick-pipeline.ts pickMarketStatByCondition`: `pickByConditionFallback` 사용. 30줄 → 7줄.
- `pack-open.ts selectMarketRowByCondition`: 동일. 40줄 → 7줄.
- `landing-showcases.ts`: inline fallback → `conditionFallbackChain()` 호출.
- `api/market/history/route.ts`: inline FALLBACK_BY_CC → `conditionFallbackChain()`.
- `api/listings/[pid]/market-source/route.ts`: 동일.

### 시세 fallback 정책 (모든 곳 동일):
- flawed/low_batt: 같은/낮은 condition 우선, 마지막 normal/worn/clean.
- unopened/mint: clean→normal 우선 fallback.
- 마지막 안전 fallback: `normal → worn → clean` 만 (unopened/mint 절대 임의 잡지 않음).

## 검증
- typecheck production clean.
- wave159 test 19/19 pass.

## 위험
- shared module 변경 시 5곳 모두 영향 — 회귀 위험 ↑. 단 변경 횟수 자체가 줄어듦 (5x → 1x).
- pack-open.ts의 `MIN_SAMPLE_COUNT_FOR_CONFIDENCE` 상수는 그대로 둠 (다른 곳에서 사용).

## 다음
- 24h 후 측정: condition_class별 sku_median 분포 변화.
- AirPods Pro 2 / iPhone 14 / AirPods Max 등 score_dirty 박은 매물 정정 효과 확인.
- 추가 비슷한 매핑 중복 발견 시 shared module 확장.
