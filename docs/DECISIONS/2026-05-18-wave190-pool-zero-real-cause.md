# Wave 190 — 풀 0건 진짜 원인 fix + skip reason 로그 (2026-05-18)

## 배경 / 진단 정정

사용자 질문 "왜 ready에 새 카테고리 없음?" 에 대해 처음엔 detail_queue가 병목이라고 결론. 사용자가 "제대로 확인했냐" 비판 → 다시 trace.

진짜 흐름:

| 단계 | 신규 카테고리 매물 | 상태 |
|------|-------------------|------|
| raw_listings sku_id 박힘 | 42 | osmo 25 / dji 7 / gopro 8 / garmin 2 ✓ |
| detail_status=done | 21 | dji 10 / osmo 4 / garmin 3 / lego 2 / gopro 2 ✓ |
| parsed 진입 | 15 | comparable_key + parse_confidence 0.8+ ✓ |
| market_price_daily 시세 | 존재 | drone / garmin / dyson 다 들어가 있음 ✓ |
| **candidate_pool row** | **0 (invalidation 조차 없음)** | **← 여기서 막힘** |

`tick-pipeline.ts:2157 trustedMarketMedian()` gate:
```ts
const total = active + sold;
if (category !== "shoe") {
  if (total < 3) return null;  // ← 신규 카테고리 거의 다 여기 차단
  if (stat.confidence === "low" && total < 5) return null;
}
```

신규 카테고리 매물:
- mvp_market_price_daily가 condition_class 별로 row 분리 (Wave 130 이후)
- 각 condition_class별 sample 1~2건 (전체 다 합치면 충분하지만 분리되어서 fail)

결과: `trustedMarketMedian = null` → mvp_listings.sku_median=0 → profit 음수 → `bandFromProfit = null` → invalidations에 push 안 함 (이미 차단된 매물은 invalidations 단계 진입 X).

Wave 173 신발 카테고리에서 동일 문제 발견 + total>=2 완화 패턴 있음.

## 결정

### 1. trustedMarketMedian — 신규 카테고리 total>=2 허용

```ts
const LOW_SAMPLE_ALLOWED_CATEGORIES = new Set<string>(["shoe", "drone", "lego", "kickboard", "perfume"]);
if (category && LOW_SAMPLE_ALLOWED_CATEGORIES.has(category)) {
  if (total < 2) return null;
} else {
  if (total < 3) return null;
  if (stat.confidence === "low" && total < 5) return null;
}
```

Safety net 작동 중:
- msrp×5 ceiling (Wave 171)
- 4 tier fake floor (Wave 141/145/152/155)
- 광고/가품 description 차단 (40+ 패턴)
- 셀러 dup 차단 (Wave 138)
- qty > 1 / num_comment >= 8 차단
- fraud group hash (Wave 138b)
- multi_device_bundle 차단

### 2. candidate-pool-builder skip reason 카운터

기존: `stats.poolSkipped` 총합만 있어서 어느 gate 차단했는지 모름. 진단 1시간+ 소요.

추가:
- `CandidatePoolBuildResult.skipReasonCounts: Record<string, number>`
- `invalidations` reduce로 reason별 집계
- tick-pipeline에서 `stats.poolSkipReasons` 박음
- `console.info("pool skip reasons (top 8)", { totalSkipped, totalAccepted, reasons })`

다음에 풀 0건/저조 디버깅 시 즉시 어느 gate 차단했는지 가시화. 운영 가시성 ↑.

## 영향 / 정책

- 신규 카테고리 매물 풀 진입 가능해짐 (다음 tick부터)
- §12b 정책: shoe 패턴과 동일 trade-off (즉시 노출 vs precision). internal_only 카테고리라 사용자 노출 영향 제한.
- 안전망 7중 작동 (위 list) — false positive 0 목표 유지.

## verify

- typecheck clean
- test:core 446/447 (사전 wave159h 1건 무관)
- commit `d8d5191`

## 다음 24h 측정

1. 신규 카테고리 candidate_pool 진입 건수
2. console.info "pool skip reasons" 분석 — 다른 gate 차단률
3. 신규 카테고리 FP rate (Wave 188 follow-up 패턴)

## 잘못한 점 자기 평가

- 처음 진단 "detail_queue 병목" 잘못. raw_listings.sku_id 박힌 매물 처음 sweep에서 "1/321" 봤는데 그건 mvp_listing_parsed.parsed_json->>'raw_sku_id' 매칭 query였고, 그 시점 reparse 처리 안 됐던 매물 다수. 별도 컬럼 raw_listings.sku_id 확인 안 함 → 잘못된 결론.
- 사용자 정당한 비판 ("제대로 확인했냐"). 다시 trace 후 진짜 원인 (parsed→pool gate) 발견.
- 같은 실수 재발 방지: 풀 진입 0건 발견 시 mvp_raw_listings.sku_id + mvp_listing_parsed + candidate_pool 3단계 모두 직접 sweep해야 함.
- 로그 보강으로 future debugging 자동화.
