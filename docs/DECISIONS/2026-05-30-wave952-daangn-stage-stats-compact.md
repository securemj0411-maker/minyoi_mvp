# 2026-05-30 wave952 - Daangn stage_stats payload compact

## 배경

- 최근 6시간 `mvp_collect_runs` 300건을 확인했을 때 Daangn ingest A/B/C의 `stage_stats`가 건당 약 47~65KB였다.
- 상위 payload 대부분은 `regionYieldStats.regions`와 `categoryYieldStats.pairs`였다.
- 이 값은 adaptive rotation의 학습 신호로 필요하지만, 매 5분 run마다 전체 region/pair 목록을 통째로 영구 저장할 필요는 낮다.

## 결정

- `regionYieldStats.regions`는 기본 상위 120개만 저장한다.
- `categoryYieldStats.pairs`는 기본 상위 80개만 저장한다.
- 전체 개수는 각각 `totalRegions`, `totalPairs`로 보존하고 실제 저장 개수는 `loggedRegions`, `loggedPairs`로 남긴다.
- 운영에서 더 보고 싶으면 아래 env로 즉시 조절 가능하다.
  - `DAANGN_INGEST_REGION_YIELD_STATS_LIMIT`
  - `DAANGN_INGEST_CATEGORY_YIELD_STATS_LIMIT`

## 기대 효과

- 당근 수집 커버리지, 외부 fetch, DB upsert, scoring에는 영향이 없다.
- collect log write/storage payload만 줄어든다.
- adaptive scoring은 여전히 최근 run의 상위 수율 지역/카테고리쌍을 읽을 수 있다.

## 보류

- yield stats를 별도 aggregate table로 옮기는 작업은 보류한다. 지금은 schema 없이 JSON payload compact만 적용했다.
- category matrix 확대/축소도 이번 범위가 아니다.
