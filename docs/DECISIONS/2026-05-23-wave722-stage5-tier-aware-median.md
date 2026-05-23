# Wave 722 / Stage 5 — band-aware-median tier-aware (시급 후속)

**Date**: 2026-05-23
**Trigger**: launch-78 "Wave 714 Stage 5 시세 query 통합 — 시급도 높음, 라벨만 D인데 시세는 옛 시스템이라 차익 계산 부정확."

## 문제

launch-78에서 fix됨:
- UI 라벨: D급 매물에 D급 chip 표시
- 비교군 필터: D급 본 매물 비교 매물 tier 매칭만 표시
- Backend `market-source/route.ts`: tier mismatch 제외

But 시세 산정 자체는 옛 conditionClass 기반:
- `band-aware-median.ts:resolveSkuMedianForDisplay`가 `condition_class` (옛 7-tier) 별 row만 fetch
- 같은 `condition_class='clean'` 안에 tier S/A/B/C/D 매물 모두 섞임
- D급 매물의 시세 = S+A+B+C+D 평균 → **D 매물 시세 부풀어져 차익 부정확**

## Solution — schema + aggregation + fetch 3단계

### 1. Schema migration (commit applied)

```sql
ALTER TABLE mvp_market_price_daily ADD COLUMN condition_tier TEXT;
UPDATE ... SET condition_tier = '' WHERE condition_tier IS NULL;
ALTER COLUMN condition_tier SET NOT NULL DEFAULT '';

CREATE INDEX mvp_market_price_daily_tier_idx ON ... (comparable_key, condition_tier)
  WHERE condition_tier IS NOT NULL;

DROP CONSTRAINT mvp_market_price_daily_pkey;
ADD PRIMARY KEY (date, comparable_key, condition_class, condition_tier);
```

- 안전: FK 참조 0 (사전 확인). 트랜잭션 단일 migration.
- non-shoe/clothing 매물: condition_tier='' (sentinel) — 기존 동작 보존
- shoe/clothing 매물: condition_tier='S'/'A'/'B'/'C'/'D'/'UNKNOWN'

### 2. Aggregation 수정 (tick-pipeline.ts)

`ParsedListingRow` type에 `condition_tier` 추가 + 3개 fetch query 컬럼 추가.

aggregation grouping key 확장:
```ts
const isShoeOrClothing = parsed.category === "shoe" || parsed.category === "clothing";
const conditionTier = isShoeOrClothing ? (parsed.condition_tier ?? "UNKNOWN") : "";
const key = `${comparableKey}|${conditionClass}|${conditionTier}`;
```

upsert payload + on conflict 컬럼:
```ts
condition_tier: group.conditionTier,
// PK: (date, comparable_key, condition_class, condition_tier)
await upsertRows("mvp_market_price_daily", marketRows, "date,comparable_key,condition_class,condition_tier");
```

### 3. band-aware-median.ts tier-aware fetch

```ts
export type MarketBandMap = Map<string, Map<string, Map<string, MarketBandRow>>>;
// comparable_key → condition_class → condition_tier → row
```

`bandAwareMedianForListing` 새 파라미터 `conditionTier`:
- tier 명시 + 해당 tier row 존재 → 직접 사용 (shoe/clothing primary path)
- tier 매칭 0 → tier 무시 fallback (legacy path)
- tier=''/null → 모든 tier sample 합쳐서 conditionClass별 최대 sample row

`collapseTierLevelToCondition` helper — nested map → flat conditionClass map (pickByConditionFallback 호환).

### 4. resolveSkuMedianForDisplay caller 업데이트

`admin/pool-listings/route.ts`에 conditionTier 전달:
```ts
const conditionTier = (p.condition_tier as string | null) ?? null;
const skuMedianFinal = resolveSkuMedianForDisplay(
  bandMap, comparableKey, conditionClass, l.sku_median, v7SiblingPresence, conditionTier,
);
```

## 영향

### 즉시 (next aggregation cron)
- 새 aggregation부터 shoe/clothing 매물 tier별 별도 row 작성
- 같은 `(comparable_key, condition_class)` 안에 tier 5개 (S/A/B/C/D/UNKNOWN) → 최대 5x row
- 기존 row condition_tier='' → legacy behavior 유지

### D급 매물 차익 정확도 ↑
- 이전: D 매물 시세 = (S+A+B+C+D 평균) → 부풀려짐 → 차익 underestimate
- 이후: D 매물 시세 = D만의 median → 정확
- launch-78 라벨/UI fix와 합쳐서 D급 매물 사용자 경험 정합성 완성

### 다른 카테고리 (전자기기 등)
- condition_tier='' (sentinel)
- 기존 동작 그대로 (변경 없음)

## 안전 가드

- FK 참조 0 확인 후 PK drop+rebuild (트랜잭션)
- tier 매칭 row 없으면 legacy path fallback (점진적 backfill 진행 중에도 안전)
- 기존 `mvp_market_price_daily` row condition_tier='' → 명시적 sentinel (NULL 아님)

## 다음 단계 (defer)

- `pack-reveal-modal.tsx` displayMarketBasis 호출처에 conditionTier 전달 (다른 세션 uncommitted 작업과 conflict — 그쪽 commit 후 연결)
- `weightedNeighborPrice` 활성화 — tier sample 부족 시 인접 tier 가중평균 (현재는 단순 tier 매칭만)
- `applyClusterRelativePricing` 시세 ratio 적용 — cluster baseline 대비 X배 (premium_archive vs casual_mass)

## 관련 파일

- `src/lib/tick-pipeline.ts` — aggregation + parsed row fetch
- `src/lib/band-aware-median.ts` — tier-aware fetch + collapse helper
- `src/app/api/admin/pool-listings/route.ts` — caller update
- `mvp_market_price_daily` schema — PK 확장 + condition_tier 컬럼

## 진행 상황

- [x] Schema migration (PK 확장, FK 참조 0 확인)
- [x] Aggregation 수정 (tick-pipeline.ts grouping + upsert)
- [x] Fetch query 컬럼 추가 (3개 query)
- [x] band-aware-median tier-aware fetch + helper
- [x] admin/pool-listings caller 업데이트
- [ ] 자연 aggregation cron 실행 → 새 tier row 박힘 (1-2일)
- [ ] 사용자 D급 매물 차익 변화 측정 (deployment + 1-2일 후)

## 검증

- [x] TS 컴파일 통과 (`tsc --noEmit`)
- [x] schema migration apply 성공
- [ ] production deploy + aggregation cron 후 mvp_market_price_daily에 tier 컬럼 채워진 row 확인
