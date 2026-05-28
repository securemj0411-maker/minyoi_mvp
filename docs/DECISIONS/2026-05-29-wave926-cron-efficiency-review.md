# Wave 926 — Cron Efficiency Review

## Context

요청: 운영 크론이 효율적으로 돌고 있는지, 비용만 쓰는 클루지가 있는지, trade-off 없이 줄일 수 있는 부분을 점검.

## Findings

- `reference-price-refresh`는 최근 8회 연속 `stale running run auto-marked after 3m`로 실패했고, `collected_count=0`, `upserted_count=0`이었다.
  - 원인 후보: 51개 다나와 query를 순차 fetch + 1초 delay로 처리하면서 route `maxDuration=90` 및 watchdog 3분 stale 한도를 넘김.
  - 현재 상태는 비용/시간은 쓰지만 기준가 갱신 결과가 없는 구조라 trade-off 없는 개선 대상으로 판단.
- 운영 DB의 `mvp_lifecycle_checks`에는 schema에 정의된 `mvp_lifecycle_checks_claim_ready_idx`가 실제로 없었다.
  - due backlog: active/missing_suspect 대상만 약 62k+.
  - `claim_mvp_lifecycle_checks` 타임아웃의 직접 원인이 될 수 있어 production에 `CREATE INDEX CONCURRENTLY`로 보강.
  - 적용 후 후보 claim explain: `mvp_lifecycle_checks_claim_ready_idx` 사용, execution 약 74ms.
- 최근 3시간 기준 고비용 크론:
  - `daangn-detail-worker`: p50 약 121s, 5,606건 detail patch. 현재는 당근 확장 직후 backlog 처리 중이라 유지.
  - `daangn-worker-b/a/c`: 수집량이 크고 ready 확대 목적에 직접 기여하므로 유지.
  - `score-worker`: p50 약 44s, A가 AI/API와 cleanup을 담당. 비용 튜닝 여지는 있으나 바로 줄이면 ready 반영 지연/정확도 trade-off가 있어 보류.
  - `pool-warmer`: p50 약 14.7s, upsert는 적지만 UX/cache warm 성격이라 즉시 축소는 보류.

## Changes

- `reference-price-refresh`
  - 기본 51개 전체 scrape 대신 하루 8개씩 rotating slice로 갱신.
  - `REFERENCE_PRICE_REFRESH_MAX_SKUS_PER_RUN`, `REFERENCE_PRICE_REFRESH_OFFSET_SEED`, `REFERENCE_PRICE_REFRESH_BUDGET_MS`, `REFERENCE_PRICE_REFRESH_DELAY_MS` env override 지원.
  - batch scraper에 `maxElapsedMs`, `delayMs` option 추가.
  - collect log stage_stats에 `candidateTotal`, `selectedOffset`, `selectedLimit`, `attempted`, budget 정보를 남김.
- Production DB
  - `mvp_lifecycle_checks_claim_ready_idx`를 `CREATE INDEX CONCURRENTLY`로 생성.
  - `ANALYZE public.mvp_lifecycle_checks` 실행.

## Deferred

- `score-worker` cleanup cadence 분리: correctness trade-off가 있어 별도 로그 관찰 후 결정.
- `daangn-detail-worker` dynamic throttle: 현재는 backlog를 빠르게 채우는 단계라 유지. detail backlog가 안정화되면 B/C shard를 자동 skip하는 조건 추가 검토.
- `pool-warmer` 축소: 사용자 체감 latency 영향 가능성이 있어 보류.
