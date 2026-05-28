# 2026-05-28 — Wave 907 Daangn Category Depth Boost

## Decision

당근 수집은 이미 267개 region을 매 run 전부 도는 nationwide firehose다. 따라서 단순히 region 수를 더 늘리는 것보다, 같은 region 첫 화면에서 잡화에 밀려 내려가는 타깃 카테고리 매물을 조금 더 끌어올리는 쪽이 더 직접적인 병목이다.

이번 wave는 기존 `?in=region` 전체 firehose를 유지하면서, 최근 수율이 좋은 일부 region에만 8개 target category fetch를 보조로 붙인다.

- 기본값: 상위 15개 region-equivalent 슬롯 × 8개 category = `+120` fetch/run
- 기존 267 fetch/run과 합쳐 약 387 fetch/run
- 과거 probe에서 full category matrix 성격의 800 fetch는 차단됐고, 267 firehose는 안정적이었다. 그래서 전국 전체 category matrix는 하지 않는다.

## Changes

- `src/lib/daangn-ingest.ts`
  - `selectDaangnCategoryBoostCombos()` 추가
  - `DAANGN_TARGET_CATEGORY_SEEDS` 단일화
  - `runDaangnIngest()`가 full-region firehose 뒤에 category-depth boost combo를 추가
  - 최근 `regionYieldStats` 점수가 있으면 고수율 region부터 boost
  - `categoryYieldStats`를 기록해서 다음 run부터 `region × category` 쌍 단위로 더 똑똑하게 boost
  - 쌍 점수가 있으면 `강남구 × 남성패션/잡화`처럼 실제 catalog hint가 많이 나온 조합을 먼저 선택하고, 남은 슬롯은 탐색으로 채움
  - broad firehose와 category boost가 같은 href를 중복으로 가져와도 detail/preselect window를 잡아먹지 않도록 parse 직후 dedupe
  - stage stats에 `categoryBoostRegions`, `categoryBoostCombos` 기록
- `src/app/api/cron/daangn-worker/route.ts`
  - `DAANGN_INGEST_CATEGORY_BOOST_REGIONS` env override 추가
  - 기본 `15`, 운영 위험 시 `0`으로 즉시 off 가능
  - `categoryYieldStats`, `categoryBoostAdaptivePairs`를 collect log에 기록
- `tests/daangn-ingest.test.ts`
  - boost combo가 점수 높은 region부터 category matrix를 만드는지 회귀 테스트 추가
  - learned pair score가 region score보다 먼저 적용되는지 회귀 테스트 추가

## Why

사용자 질문: "당근에서 가져오는 걸 더 많이 하면 시세표본 빨리 쌓이는 것 아닌가?"

맞다. 다만 현재 fetch 자체는 이미 전국 단위로 크고, 최근 병목은 아래 두 층이었다.

1. 가져온 후보 중 기존 row가 많아 fresh row가 write cap 앞에서 밀림
2. region 첫 화면이 전체 카테고리 최신순이라 target-category 깊은 매물이 안 보일 수 있음

Wave 906에서 1번은 preflight window를 넓혀 완화했다. Wave 907은 2번을 작게 연다.

## Deferred

- `categoryBoostRegions`를 20~30으로 늘리는 것은 다음 production run 로그를 보고 결정한다. 쌍 점수가 쌓이면 같은 요청 수에서도 잡화/저수율 category 낭비가 줄어든다.
- `maxUpsertArticles` 500 상향도 보류한다. category boost + wider preflight 적용 후 `classifyCandidates`, `preflightOverflow`, `durationMs`, block signal을 먼저 본다.
- 전국 267 region × 8 category 전체 matrix는 보류한다. 이전 probe 기준 차단 위험이 높다.

## Monitoring

다음 deploy 후 `mvp_collect_runs.stage_stats`에서 확인할 것:

- `categoryBoostCombos = 120`
- `duplicateArticlesDropped`가 늘어도 `upsertCandidateArticles` window가 중복에 먹히지 않는지
- `categoryBoostAdaptivePairs > 0` after one or more deployed runs
- `blockedCombos = 0`
- `failedCombos / combos` 급증 없음
- `catalogHintArticles`, `upsertCandidateArticles`, `rawUpserted` 증가
- `timingsMs.searchFetch`와 `durationMs`가 300s 한도에 충분히 남는지

위험 신호가 있으면 Vercel env:

```text
DAANGN_INGEST_CATEGORY_BOOST_REGIONS=0
```

으로 바로 끈다.
