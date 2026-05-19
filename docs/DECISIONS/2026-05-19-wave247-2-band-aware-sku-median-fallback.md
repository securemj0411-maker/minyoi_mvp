# Wave 247.2 — Pool API band-aware sku_median fallback

- date: 2026-05-19
- type: pool API fetch logic (additive only — DB 변경 X)
- scope: `mvp/src/app/api/packs/pool/route.ts`
- branch: `ux/me-cleanup-2026-05-19`

## 배경

Wave 246 에서 me 페이지 "시세 0원" bug 측정 중 발견: production 풀의 일부 매물 (16% — 82/500) 이 `mvp_listings.sku_median = 0/null`.

원인:
- pool API (`/api/packs/pool`) 가 `mvp_listings.sku_median` 컬럼 직접 read.
- `mvp_listings.sku_median` 은 SKU 전체 median — condition_class 무시.
- 일부 SKU 는 전체 median 계산 안 됨 (sample 부족 etc) → 0/null.
- pack-open (`/api/packs/reveal/open`) 는 `mvp_market_price_daily` band-aware lookup → 정확.
- pool API 만 raw skim → 동일 SKU 라도 pool 화면에서 0원 표시.

발견 데이터 (production 측정):
- 전체 `mvp_listings`: 41.1% sku_median=0 (11488/27961).
- 현재 ready pool: 0% (선별 시 0원 매물 제거됨).
- 그러나 pool 매물 중 일부는 exact band 매칭 안 됨 (3/100 sample) — band fallback 필요.

## 결정

pool API 가 매물별 `comparable_key` + `condition_class` 기반 band-aware lookup. 기존 `mvp_listings.sku_median` 은 최종 fallback 으로 유지.

### Fallback chain (정책: 위로 fallback 금지, 같거나 아래로만 — Wave 178)

```
1. 매물 condition_class 매칭 band (e.g. mint → mvp_market_price_daily mint row blended_median_price)
2. 매칭 band 없으면 condition-fallback chain:
   - mint → clean → normal → worn → all
   - clean → normal → worn → all  (mint 위로 금지)
   - normal → clean / worn (양방향, 가까운 condition)
   - worn → normal → all  (mint/clean 위로 금지)
   - flawed → worn → low_batt → normal → all  (mint/unopened 절대 X)
3. 모든 band 없으면 raw mvp_listings.sku_median (현재 기본값)
```

### 구현

`mvp/src/app/api/packs/pool/route.ts`:

1. `loadMarketBandsForPool(headers, comparableKeys)` — pool 의 모든 unique `comparable_key` 일괄 fetch (병렬 — 기존 raw/meta fetch 와 같이).
2. `bandAwareMedian(bandMap, comparableKey, conditionClass)` — pack-open 의 `marketBasisForCandidate` 와 동일 정책 (shared `pickByConditionFallback`).
3. `buildItems` — 각 매물에 대해 `bandAwareMedian` 우선, 없으면 raw `sku_median` fallback.

### 정책 준수

- additive only — DB 변경 X. 새 컬럼/migration 없음.
- `pickByConditionFallback` shared module 재사용 — DRY 원칙.
- Wave 178 (위로 fallback 금지) 정책 자동 적용 — flawed 매물에 mint/unopened 가격 임의 fallback 차단.

## 검증

- unit test `tests/wave247-2-band-aware-pool-median.test.ts` 10건 PASS:
  - mint condition + mint band → mint 가격
  - mint band 없으면 clean fallback (위로 차단)
  - worn band 없으면 normal fallback (mint 임의 X)
  - **CRITICAL** flawed + mint 만 → null (mint 임의 fallback 차단)
  - comparable_key 없음 / 미매칭 → null
  - band 있지만 가격 0 → null (sku_median fallback)
  - blended_median_price 우선, active_median_price fallback
  - blended null → active 사용
  - conditionClass null → normal chain

- test:core: 572/579 pass (10건 새 test 모두 pass, 7건 pre-existing /me UI contract failure — 본 wave 영향 X).

## 효과 예측

- pool 매물 중 exact band 매칭 안 되는 매물 (sample 100 중 3) → band fallback 으로 시세 표시.
- 미래 신규 SKU 의 sku_median 계산 안 됨 시점 (cron tick 늦음) 에도 즉시 band-aware 시세 표시.
- defense-in-depth — `mvp_listings.sku_median` recompute 누락 / 신규 SKU 등록 직후 0원 표시 위험 해소.

## 후속 (사용자 결정 필요 — 별도 wave)

`mvp/src/lib/candidates.ts` line 103-104 `Math.max(0, sku_median - listing_price)` clamp 정책:
- Option 1: clamp 유지 — 음수 차익 = display 0 (매물 가격 > 시세 시 안 보임)
- Option 2: clamp 제거 — negative 허용 → "이미 비싼 매물" 표시 (사용자 신뢰)
- Option 3: candidate-pool-builder 단계에서 차익 음수 매물 차단 (root fix — pool 자체에서 제외)

**현재 wave 에서는 박지 X (사용자 결정 대기).**

## decision log

- 본 wave 는 additive only — 사용자 결정 별도 X.
- production rematch 필요 X — pool API runtime 적용, fetch 만 변경.
- 24h 후 효과 측정 (별도 wave) — 사용자 풀에서 0원 매물 비율 감소 확인.
