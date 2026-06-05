# Wave 1178 — Feed First Paint Budget

## 결정
- `/api/packs/pool`의 당근 근처 prefetch가 첫 화면 quick request에서도 최대 8초까지 기다릴 수 있던 구조를 분리했다.
- quick request는 `DAANGN_NEARBY_FEED_QUICK_PREFETCH_BUDGET_MS` 기본 1.2초로 제한하고, refresh/background request는 기존 8초 예산을 유지한다.
- 당근 근처 raw 조회 단계에서 `priceMax`가 있으면 `mvp_raw_listings.price <= priceMax`를 바로 적용한다.
- 15만원 이하 같은 예산 필터에서 비싼 raw rows를 먼저 훑은 뒤 나중에 탈락시키는 비용과 빈 화면 가능성을 줄였다.
- 첫 카드 렌더 직후 500개 background hydration을 바로 시작하지 않고, 당근/거리 피드는 900ms 지연 후 조용히 붙이도록 했다.
- 느린 `/api/packs/pool` 응답은 1.2초 이상이면 `[pool] response` 로그로 quick/refresh/source/budget/nearby prefetch stats를 남긴다.

## 보류
- 근본 최종형은 `mvp_feed_cards` 또는 지역별 feed snapshot/materialized table을 worker가 미리 만들고, 피드 API는 조립이 아니라 읽기만 하는 구조다.
- 예산 필터의 완전한 DB-side 해결은 candidate_pool 또는 feed snapshot에 `buy_price`, `source`, `region`, `distance bucket`, `display card json`을 denormalize해야 한다.
- 이번 wave에서는 DB schema 변경 없이 첫 진입 병목과 관측 가능성만 줄였다.
