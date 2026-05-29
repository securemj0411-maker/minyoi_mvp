# 2026-05-29 Wave 936 — 당근 score 3-shard 운영 env 검증

## 배경

Wave 935 코드 배포 후 A는 `0/3`, C는 `2/3`으로 확인됐지만 B는 계속 `1/2`로 실행됐다.

원인은 `minyoi-mvp-atff` Vercel production env에
`PIPELINE_SCORE_B_DAANGN_SHARD_COUNT=2`가 명시되어 있었기 때문이다. 이 값은 코드 기본값보다
우선되어 B score worker가 계속 2-shard 체계로 돌게 만들었다.

## 적용

- `minyoi-mvp-atff` production env:
  - `PIPELINE_SCORE_B_DAANGN_SHARD_COUNT`를 `2`에서 `3`으로 변경
- B 프로젝트를 production redeploy 했다.

## 검증

직접 cron 호출 기준:

- A `/api/cron/score-worker?force=1`
  - `score_daangn_shard_index=0`
  - `score_daangn_shard_count=3`
  - `score_rows_loaded=100`
- B `/api/cron/score-worker-b?force=1`
  - `score_daangn_shard_index=1`
  - `score_daangn_shard_count=3`
  - `score_rows_loaded=100`
- C `/api/cron/score-worker-c?force=1`
  - `score_daangn_shard_index=2`
  - `score_daangn_shard_count=3`
  - `score_rows_loaded=100`

같은 시점 ready pool:

- 전체 ready: 3,327건
- 당근 ready: 2,495건
- 번개 ready: 767건
- 중고나라 ready: 65건

## 후속 관찰

- 최근 15분 기준 score worker A/B/C 합산 `score_rows_loaded`는 약 2,500건이었다.
- 이전 2-shard 로그가 윈도우에 섞여 있어, 이후 15~30분 윈도우에서는 A/B/C가 모두 `*/3`만
  남는지 재확인한다.
- detail worker는 이미 A/B/C shard로 분산되어 있으나 일부 run이 130~160초까지 길다.
  ready 공급 병목이 다시 보이면 detail fetch delay/limit 조정은 별도 wave에서 검토한다.
