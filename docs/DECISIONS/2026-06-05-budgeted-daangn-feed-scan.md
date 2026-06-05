# 2026-06-05 Budgeted Daangn Feed Scan

## 결정
- 15만원/30만원 같은 예산 필터가 걸린 추천 피드는 `mvp_candidate_pool` 상위 1,500개만 훑지 않고 `FEED_BUDGET_READY_SCAN_LIMIT` 기본 6,000개까지 스캔한다.
- 0건 응답 시 프론트에서 조용히 예산 필터를 전체 가격대로 풀던 자동 완화 로직을 제거한다.

## 이유
- `mvp_candidate_pool`에는 현재 매입가가 denormalize되어 있지 않아 API가 ready 후보를 먼저 읽고 `mvp_listings.price`를 조인한 뒤 예산 필터를 적용한다.
- 기존 상위 1,500개 profit-order scan에서는 동작구 기준 당근 15만원 이하 근거리 후보가 9개만 잡혔다.
- 같은 DB 기준으로 전체 ready scan에서는 동일 조건 후보가 171개 잡혔다. 즉 후보가 없는 문제가 아니라 budgeted feed가 풀을 얕게 읽는 구조적 누락이었다.

## 검증
- 2026-06-05 14:35 KST 기준 DB dry-run:
  - ready scanned: 4,915
  - old top 1,500 budget+nearby candidates: 9
  - new budget scan candidates: 171

## 보류
- 근본 성능 개선으로 `mvp_candidate_pool`에 `price_krw`, `source`, `daangn_region_id` 같은 feed filter columns를 denormalize하거나 DB-side feed RPC를 만드는 작업은 별도 wave로 보류한다.
- 현재 패치는 예산 필터 요청에만 넓은 scan을 적용해 launch-safe correctness를 먼저 회복한다.
