# Wave 252.A — sku_median band-aware fetch (comparable_key + condition_class) admin-pool-browser

date: 2026-05-20
status: applied
owner: claude-agent (자율) — 사용자 명시 plan, additive only

## 배경

사용자 직접 production 검증 결과 발견된 3 root cause 중 1번째 (가장 큰 ROI):

> `mvp_listings.sku_median` = sku_id 전체 median (comparable_key 별 분리 X)
> v7 parser (Wave 236) 가 comparable_key 에 product-type 추가했지만 sku_median 산정 그대로
> BAPE tee SKU: 후드 30만 + 티 7만 → 같은 sku_median 109k 비교
> 사용자 코멘트 id 201/202 정확 이 원인
> Wave 251.4 (market-source filter) 는 비교 매물 list 만 fix, **me 페이지 차익 표시는 그대로 잘못**

## 사용자 카드 3 화면 상태 (memory ui_changes_apply_to_all_card_screens)

| 화면 | 컴포넌트 | sku_median fetch | 상태 |
|---|---|---|---|
| pack-reveal-modal | pack-reveal-modal | marketBasisForCandidate (band-aware) | ✅ 이미 정합 |
| user-reveal-dashboard (/me) | user-reveal-dashboard / packs/me API | marketBasisForCandidate (band-aware) | ✅ 이미 정합 |
| admin-pool-browser | admin/pool-listings API | raw mvp_listings.sku_median | ❌ Wave 252.A fix |
| freemium pool (/api/packs/pool) | pool/route.ts | inline band-aware (Wave 247.2) | ✅ 이미 정합 |

→ 본 wave 의 fix 대상: **admin-pool-browser 의 admin/pool-listings/route.ts**.

## fix

### 1) `src/lib/band-aware-median.ts` 신설 (DRY)

- `loadMarketBandsForKeys(headers, keys)` — (comparable_key, condition_class) 별 최신 row fetch.
- `bandAwareMedianForListing(map, key, condition)` — 매물 condition 매칭 band 우선 + condition-fallback chain.
- `resolveSkuMedianForDisplay(map, key, condition, rawSkuMedian)` — band → raw fallback 통합.

Wave 247.2 의 pool/route.ts 안에 inline 박은 helper 정책 그대로 lib 모듈로 추출.
pack-open.ts 의 marketBasisForCandidate 의 condition-fallback (pickByConditionFallback) 동일 chain 사용 → 정합 보장.

### 2) `src/app/api/admin/pool-listings/route.ts`

- band map fetch 추가 (comparableKeys 이미 수집 중).
- 각 매물 row 의 `skuMedian` 을 `resolveSkuMedianForDisplay(bandMap, comparableKey, conditionClass, l.sku_median)` 로 교체.
- additive: band 없거나 sample 부족 시 raw mvp_listings.sku_median 그대로 fallback.

## 영향 매물 (예측)

검증 SQL:

```sql
-- pid 407160018 (BAPE 마일로 반팔티, mint):
--   현재 mvp_listings.sku_median = 109,500
--   (clothing|bape_tee|tee|a_grade, mint) market_price_daily blended_median = 78,200 (6 samples)
--   → band-aware 적용 후 admin-pool-browser 화면 시세 = 78,200
```

영향 화면: admin-pool-browser (admin 검증 도구). 일반 사용자 화면(/me, /pool reveal) 은 이미 정합이라 변화 X.

## 위험 / 회귀

- **부재 시**: band 없으면 raw mvp_listings.sku_median fallback — 기존 동작 보존 (additive).
- **band 잘못 매칭**: condition-fallback chain (pickByConditionFallback minSamples=1) 동일 정책 → pack-open.ts 와 정합.
- **sample 1건이라 outlier 위험**: pickByConditionFallback Wave 193 정책 (minSamples=1) 그대로 — admin 검증 도구라 outlier 노출이 오히려 발견 ROI ↑.

## test:core 결과

- pre-existing 9 fails (me-page-contract UI tests) 그대로 — Wave 252.A 와 무관.
- 모든 catalog/pipeline/option-parser/condition-fallback test 그대로 pass.
- band-aware-median.ts 는 신규 helper — 자체 unit test 없음 (사용처 admin/pool-listings 통합 적용으로 검증).

## 후속

- Wave 252.B (v3 매물 12k 강제 rematch) — 사용자 결정 필요. agent 자율 X.
- Wave 252.C — rematch trigger helper 자동화 (다음 단계).
- (선택) pool/route.ts 의 inline helper 도 band-aware-median.ts 의 shared 함수로 migrate 가능 — 별도 wave (Wave 252.D 후보).
- (선택) hotdeal.ts 의 admin shadow display 도 band-aware migrate 가능 — telegram 정확도 향상.
