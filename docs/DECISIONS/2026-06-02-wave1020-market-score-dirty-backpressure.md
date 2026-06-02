# Wave 1020 — Market score_dirty backpressure

## 배경

Wave 1018/1019 후에도 market-worker의 score_dirty marking 단계가 병목으로 남았다.

최근 run:

- 20:02 KST
  - `market_mark_score_dirty_ms=164083`
  - `candidate=0`, `marked=0`
  - RPC path가 비싸게 돌아 즉시 opt-in으로 내림.
- 20:12 KST
  - RPC off hotfix 후 REST scoped path
  - `market_mark_score_dirty_ms=69981`
  - `candidate=0`, `marked=0`

이미 active/scorable score_dirty backlog가 약 169K 수준이었다. 이 상태에서 market-worker가 매 run마다 “시세가 바뀐 comparable_key의 raw row를 더 dirty 처리”하려 하면 score worker가 즉시 소화할 수 없고, market-worker만 느려진다.

## 결정

market-worker의 score_dirty 추가 marking에 backpressure를 넣었다.

기본 정책:

- active/scorable dirty backlog가 `1000`개 이상이면 market-worker는 추가 score_dirty marking을 skip한다.
- skip 시 `stage_stats.stages.market_stats.timingsMs.market_score_dirty_skipped_backlog=1000` 기록.

조건 확인:

- `score_dirty=true`
- `detail_status=done`
- `sku_id is not null`
- `listing_state=active`
- `listing_type=normal` 또는 `listing_type_override=normal`

환경변수:

- `PIPELINE_MARKET_SCORE_DIRTY_BACKLOG_SKIP_LIMIT`
- default: `1000`
- `0`이면 backpressure 비활성화.

## 안전성

- 시세 계산/업서트는 그대로 수행한다.
- reveal current profit recompute도 그대로 수행한다.
- candidate scoring queue에 추가 row를 넣는 단계만 backlog가 클 때 멈춘다.
- 이미 쌓인 score_dirty backlog는 score-worker A/B/C가 계속 처리한다.
- 데이터 삭제 없음.

## 보류

- backlog가 충분히 줄어든 뒤 market score_dirty marking을 재활성화할지 기준값을 다시 조정한다.
- active/scorable dirty backlog 자체를 빠르게 줄이는 별도 drain 전략은 다음 wave에서 검토한다.
