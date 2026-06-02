# Wave 1018 — Market worker score_dirty scope 정합화

## 배경

2026-06-02 운영 알림에서 `Market` 실패율/지연이 반복됐다. 최근 `mvp_collect_runs`를 확인하니 `/api/cron/market-worker`의 `market_stats`가 18초~270초까지 크게 흔들렸다.

대표 baseline:

- 19:12 KST: `market_stats=17.998s`, `market_score_dirty_candidate_rows=300`, `marked_rows=37`
- 19:22 KST: `market_stats=270.077s`, `market_score_dirty_candidate_rows=5000`, `marked_rows=1857`
- 18:52 KST: `market_stats=268.360s`, `market_score_dirty_candidate_rows=5000`, `marked_rows=1416`

읽기 전용 점검:

- pending invalidation 3000 row read는 약 3~4초 수준으로 재현됐다.
- top invalidation key의 parsed/raw read는 각각 수백 ms~1.6초 수준으로 재현됐다.
- 같은 key 샘플에서 `score_dirty=false` 136건 중 실제 score worker가 처리 가능한 active/scorable row는 42건이었다.

## 결정

`market-worker`가 시세 갱신 후 `score_dirty=true`로 재평가 큐에 넣는 대상을 score worker의 scorable 조건과 맞췄다.

기존:

- comparable_key에 매칭되는 parsed pid를 최대 5000건 모은 뒤, raw row가 `score_dirty=false`이면 넓게 dirty 처리.
- 이 과정에서 sold/disappeared/non-normal/detail 미완료 row도 dirty 후보가 될 수 있었다.
- score worker가 나중에 reject/cleanup해야 할 backlog가 커졌다.

변경:

- market price sample 자체는 기존처럼 active/sold/disappeared를 모두 사용한다.
- 하지만 score 재계산 큐에는 candidate pool에 들어갈 수 있는 row만 넣는다.
- 조건:
  - `score_dirty=false`
  - `detail_status=done`
  - `sku_id is not null`
  - `listing_state=active`
  - `listing_type=normal` 또는 `listing_type_override=normal`

또한 `marketStatsStage` 내부 substage timing을 `stage_stats.timingsMs`에 추가했다.

추가 timing:

- `market_load_pending_invalidations_ms`
- `market_load_invalidated_parsed_ms`
- `market_load_sibling_parsed_ms`
- `market_load_raw_rows_by_pids_ms`
- `market_load_raw_rows_recent_ms`
- `market_ensure_parsed_rows_ms`
- `market_upsert_daily_ms`
- `market_mark_invalidations_done_ms`
- `market_mark_score_dirty_ms`
- `market_mark_stale_lane_score_dirty_ms`
- `market_recompute_reveal_current_profits_ms`
- `market_velocity_self_heal_check_ms`
- `market_velocity_self_heal_rpc_ms`

## 안전성

- 데이터 삭제 없음.
- schema 변경 없음.
- 시세 산정 sample 범위 변경 없음.
- reveal current profit recompute 유지.
- score_dirty queue 대상만 실제 scorable active row로 좁힘.

## 검증

- `npm run build` 통과.
- 기존 production baseline은 배포 전 위 수치로 기록.

## 보류

- `market_score_dirty_candidate_rows` 자체가 5000까지 뜨는 원인은 아직 완전히 줄이지 않았다. 이번 변경은 dirty patch/write 대상 축소가 1차 목표다.
- 배포 후 다음 market-worker run에서 `market_mark_score_dirty_ms`, `market_score_dirty_marked_rows`, 전체 `market_stats`를 확인해 남은 병목을 분해한다.
- 필요 시 다음 wave에서 `markRawScoreDirtyByComparableKeys`의 parsed pid load limit/budgeting 또는 DB-side RPC를 검토한다. 단, score 재계산 누락/지연 trade-off가 있으므로 수치 확인 후 진행한다.
