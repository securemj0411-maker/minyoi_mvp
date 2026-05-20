# 2026-05-20 — reveal 상세 판매완료 감지와 번개 거래가 갱신 연결

## 배경

사용자 질문: 시세 그래프에서 `번개장터 호가`는 일별로 보이는데 `번개장터 거래가`가 오늘/최근 감지일에만 찍히는 것처럼 보인다. `/me` 갱신 또는 reveal 상세 확인 시 판매완료를 잡는다면 그 값을 거래가 시계열에도 반영할 수 있어야 한다.

## 확인

- `/api/market/history`는 별도 거래 이벤트 테이블이 아니라 `mvp_market_price_daily.sold_median_price`를 그대로 읽는다.
- `marketStatsStage`는 집계 실행일(`kstDateString()`) 기준으로 오늘 row를 upsert한다. 과거 일자 row를 판매 감지일 이전으로 retroactive backfill하지 않는다.
- 크론 lifecycle 경로는 `sold_confirmed` 전환 시 raw/lifecycle/pool 갱신, observation 기록, `mvp_market_key_invalidation` enqueue를 수행한다.
- 반면 reveal 상세 경로(`loadRevealListingDetail`)는 판매완료/삭제 감지 시 raw/lifecycle/pool만 갱신했고 market invalidation 및 observation 기록이 없었다.

## 결정

reveal 상세에서 terminal 상태를 감지하는 경로도 lifecycle과 같은 방향으로 맞춘다.

- `mvp_raw_listings.last_seen_at`을 현재 시각으로 함께 갱신해 market worker 28h lookback에서 빠지지 않게 한다.
- parsed comparable key를 읽어 `enqueue_mvp_market_key_invalidation` RPC를 호출한다.
- `mvp_listing_observations`에 `state_changed` fact를 남긴다.

## 보류

- 과거 그래프를 "판매 감지일" 또는 "마지막 active 관측일" 기준으로 재작성하는 schema/backfill은 별도 결정으로 보류한다. 현재 `mvp_market_price_daily`는 일별 snapshot aggregate라 과거 날짜 row를 자동으로 재계산하지 않는다.
- 진짜 거래 이벤트 시계열을 만들려면 `mvp_listing_observations` 또는 별도 sold-event fact를 market history API가 읽도록 확장해야 한다.
