# Wave 159g — 시세 fallback chain 4곳 동기화 (Wave 159f 후속)

- 시간: 2026-05-17 KST

## 발견 (자동 사이클)

[Wave 159f](2026-05-17-wave159f) 박은 tick-pipeline.ts fallback fix가 다른 3곳에 동기화 안 됨. 같은 버그가 별개 코드에 존재:

| 위치 | 버그 |
|---|---|
| `pack-open.ts:522` `CONDITION_FALLBACK_ORDER` | `flawed` 키 누락 + `low_batt: ["low_batt", "all"]` 짧음 + 마지막 fallback `byCondition.values().next().value` (임의 entry) |
| `landing-showcases.ts:258` | `fallback = [conditionClass, "normal", "all", "clean", "worn", "mint"]` — mint 포함 → flawed/worn 매물 mint 시세 잡힘 |
| `api/market/history/route.ts:70` | `[ccFilter, "mint", "normal", "all", "clean", "worn"]` — ccFilter 무관하게 mint 두 번째 |
| `api/listings/[pid]/market-source/route.ts:96` | `[target, "mint", "normal", "all", "clean", "worn"]` — 동일 |

영향: pack-open (실제 사용자 팩 오픈 시 차익 계산), landing (랜딩 페이지 showcase), market 차트/디버그 모두 시세 부풀려질 위험.

## 변경 (4 files)

### 1. pack-open.ts
```typescript
const CONDITION_FALLBACK_ORDER: Record<string, string[]> = {
  unopened: ["unopened", "mint", "clean", "normal", "all"],
  mint: ["mint", "unopened", "clean", "normal", "all"],
  clean: ["clean", "normal", "mint", "all"],
  normal: ["normal", "clean", "worn", "all"],
  worn: ["worn", "normal", "all"],
  low_batt: ["low_batt", "worn", "normal", "all"],          // 보강
  flawed: ["flawed", "worn", "low_batt", "normal", "all"],  // 신규
  all: ["all", "normal", "clean", "worn", "mint"],
};
```
마지막 fallback도 안전화:
```typescript
const safeFallback = byCondition.get(target) ?? byCondition.get("normal") ?? byCondition.get("worn") ?? byCondition.get("clean");
```

### 2. landing-showcases.ts
```typescript
// mint 제거 — flawed/worn 매물 mint 시세 fallback 차단
const fallback = [conditionClass, "normal", "all", "clean", "worn"];
```

### 3. api/market/history/route.ts
condition별 fallback chain 분리 (4곳 모두 동일 정책):
```typescript
const FALLBACK_BY_CC: Record<string, string[]> = { unopened: [...], mint: [...], ... flawed: [...] };
const fallbackOrder = ccFilter ? (FALLBACK_BY_CC[ccFilter] ?? [...]) : ["all", "normal"];
```

### 4. api/listings/[pid]/market-source/route.ts
동일 매핑 + 마지막 안전 fallback (normal/worn/clean만):
```typescript
marketStats = marketStats
  ?? rows.find((r) => r.condition_class === "normal")
  ?? rows.find((r) => r.condition_class === "worn")
  ?? rows.find((r) => r.condition_class === "clean")
  ?? null;
```

## 검증
- typecheck production clean.
- 4곳 모두 동일 정책: flawed/low_batt 매물에 unopened/mint 시세 임의 fallback 차단.

## 위험
- **DRY 위반**: 4곳에 같은 fallback chain 매핑 중복 박힘. 미래 fallback 정책 변경 시 4곳 동시 수정 필요. 별도 wave에서 `src/lib/condition-fallback.ts` 같은 shared module로 통합 검토.
- **기존 사용자 reveal**: pack-open으로 이미 사용자에게 노출된 매물의 차익은 그대로. 정정 불가 (history).

## 다음
- shared module 통합 (DRY)
- 24h 후 측정: condition_class별 sku_median 분포 변화 + 부풀려진 시세 정정 효과
- iPhone 14 같은 매물 일괄 score_dirty=true 재마킹 검토 (정정 즉시 적용)
