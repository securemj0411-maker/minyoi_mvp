# 2026-05-29 Wave 935 — score shard count와 ingest shard env 분리

## 배경

Wave 933/934 이후 C score worker는 `/api/cron/score-worker-c`에서 `2/3` shard로 정상 실행됐다.
하지만 `mvp_collect_runs` 확인 결과 A/B score worker는 여전히 `0/2`, `1/2`로 실행됐다.

원인은 score route가 `PIPELINE_SCORE_DAANGN_SHARD_COUNT`가 없을 때
`DAANGN_INGEST_REGION_SHARD_COUNT`를 fallback으로 읽고 있었기 때문이다. 운영 env에는
당근 수집 분산을 위한 `DAANGN_INGEST_REGION_SHARD_COUNT=2`가 남아 있어, score 처리도
잘못 2샤드로 묶였다.

## 결정

- score worker A/B의 shard count/index는 score 전용 env만 읽는다.
  - A: `PIPELINE_SCORE_DAANGN_SHARD_COUNT`, `PIPELINE_SCORE_DAANGN_SHARD_INDEX`
  - B: `PIPELINE_SCORE_B_DAANGN_SHARD_COUNT`, `PIPELINE_SCORE_DAANGN_SHARD_COUNT`,
    `PIPELINE_SCORE_B_DAANGN_SHARD_INDEX`
- ingest shard env(`DAANGN_INGEST_*`)는 score route fallback에서 제거한다.
- score 전용 env가 없으면 코드 기본값으로 A/B/C가 각각 3샤드 체계(`0/3`, `1/3`, `2/3`)로 돈다.

## 기대 효과

- A/B/C score worker가 서로 겹치지 않는 3-way 분산으로 작동한다.
- 당근 raw 유입량이 많을 때 score backlog를 더 빨리 소화한다.
- 수집 분산 설정을 바꿔도 score 분산이 의도치 않게 같이 바뀌지 않는다.

## 보류

- Vercel env의 `DAANGN_INGEST_REGION_SHARD_COUNT` 자체는 그대로 둔다. 수집 쪽에서 쓰는 값이므로
  score 최적화 때문에 제거하지 않는다.
- score batch size 증설은 이번 wave에서 보류한다. 먼저 3-way 분산 적용 후 처리량을 재측정한다.
