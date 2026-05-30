# Wave 894 — 시세 집계 sold sample 회수 (호가 × 0.92 fallback 의존도 ↓)

## 사용자 incident (root signal)

- 시간: 2026-05-30
- 사건: 사용자가 우리 서비스 시세 11만원 보고 NB 991을 8만원에 구매 → 당근에 재판매 시도하니 당근 자체 AI 가 "최근 판매가 3~5만원" 표시. 사용자 실손실 + 우리 시세 신뢰도 큰 손상.
- 사용자 짚음: "판매완료 찍는 크론이 젤 우선 아님?? 애초에?"

## 진단 (DB 직접 측정)

- 전체 시세 row 91.8% 가 `sold_sample_count = 0` (호가 only) → blended_median 이 `active_median × 0.92` fallback 으로 계산됨.
- raw_listings 에는 sold 매물 충분: 당근 43,547 / 번장 15,948 / 중나 526. 즉 detect 자체는 OK.
- **시세 집계 진입 자격**: 당근 3.4% / 번장 26% / 중나 95.8% 만 통과. 당근 96.6% sold 데이터가 시세에 미반영.
- **원인**: `loadMarketStatRows` SQL filter `detail_status=eq.done` 가 sold/disappeared 매물까지 일률 적용.
  - 당근 ingest: active 매물만 detail enrich (`hasDetailPayload` 검사) → done.
  - sold 로 전환된 매물은 detail enrich 대상에서 빠짐 → pending 상태로 누적.
- NB 991 raw sold 7건 (당근 80K~230K, median 170K) 모두 detail_status=pending → 시세 집계 누락 → fallback 0.92 가 active 270K × 0.92 = 248K 박힘.

## 변경

`src/lib/tick-pipeline.ts`:

- `loadMarketStatRows` (line ~2722) SQL filter:
  - 기존: `detail_status=eq.done & listing_state=in.(active,sold_confirmed,disappeared)`
  - 변경: `and=(or(and(listing_state.eq.active,detail_status.eq.done),listing_state.in.(sold_confirmed,disappeared)), or(listing_type.eq.normal,listing_type_override.eq.normal))`
  - 즉 active 만 detail done 요구, sold/disappeared 는 detail 무관.
- `loadMarketStatRowsByPids` (line ~2757) 동일 패턴 적용 (lookup endpoint 등 fast-path 일관성).

## 검증 (DB 직접)

- 당근 sold (7일, sku 매칭): 1,472 → 22,024건 시세 진입 (**14배 회수**).
- 다음 market-worker cycle (vercel.json: `2,12,22,32,42,52 * * * *`) 부터 자동 적용.
- 안전 가정: sold 매물은 가격이 fixed (closing price) → title 기반 1차 comparable_key 만 있으면 충분. detail enrich 으로 condition_class 정교화는 active 한정.
- parsed map lookup 에서 comparable_key 없으면 자동 drop → bad data 누락 위험 없음.

## 위험

- active 가 아닌 매물의 condition_class 가 detail 없이 title-only 로 박혀있음. fashion 의 경우 cc 정확도 낮을 수 있으나 Wave 803i/814-818 에서 tier-aware 정책 박힘 (fashion 은 cc 무시) → 영향 최소.
- 영향 범위: 시세 정확도 ↑, candidate-pool 점수, 사용자 가시 시세, market-velocity, landing showcase 모두 자동 반영.

## 다음

- (후속) `daangn_bulk_upsert_raw_listings_v2` RPC 에서 prev_state=active && new_state=sold_confirmed 전환 시 `sold_detected_at` 박기 — 현재 당근 sold 43,547 중 sold_detected_at 박힌건 16건 (0.0%). audit/분석용으로 backfill 필요.
- (후속) fashion/shoe 카테고리 호가 × 0.92 fallback factor 재측정. sold 회수 후 실제 sold median vs active median 차이 측정해서 카테고리별 factor 박기 (휴대폰 ~0.95, 가전/노트북 ~0.88, 패션 ~0.78 추정).
- (후속) sold_sample_count = 0 시 confidence 강제 "low" + UI 에 "호가 기준 추정" 라벨 — 사용자가 실거래 vs 호가 구분 가능.
- (후속) 당근 detail-worker 가 sold 매물도 enrich 하도록 큐 정책 변경 (현재 active 만 큐 진입). detail_status=done 보장하면 위 filter 분기 불필요해짐.
