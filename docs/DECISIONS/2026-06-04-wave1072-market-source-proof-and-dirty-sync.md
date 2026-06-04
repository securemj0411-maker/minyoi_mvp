# 2026-06-04 Wave 1072 - source 시세 증거와 score dirty 동기화

## 결정

- 당근 source 시세는 comparable key invalidation 시 여러 key를 얕게 섞어 처리하지 않고, key 단위로 충분한 표본을 읽어 재계산한다.
- market row가 갱신되면 score dirty backlog가 있어도 해당 comparable key의 scorable rows는 반드시 dirty로 표시한다.
- 상세/쉬운모드의 비교 매물 증거 리스트는 p25~p75 active band만 보여주지 않고, blended median 근처의 sold/anchor 샘플도 보이게 한다.

## 배경

- `초S급 나이키 조던1 로우 SE 초콜렛 블리스 265`에서 상세 화면은 당근 source blended median 106,000원을 기준으로 수익을 계산했지만, 비교 매물 리스트는 90,000~105,000원대 active 샘플 위주로 보여 시세와 증거가 서로 맞지 않았다.
- 운영 DB 재계산 결과 같은 key의 당근 source median은 64,500원으로 내려갔고, 해당 PID의 `mvp_listings.sku_median`도 64,500원으로 갱신됐다.
- 기존 `mvp_candidate_pool` row는 `profit_roi_above_45pct_weak_signal_review`로 invalidated였고, 재계산 후 `negative_resell_gap`로 정리됐다.

## 구현

- `src/lib/tick-pipeline.ts`
  - market invalidation key chunk 기본값을 10 -> 1로 낮춰 한 key가 부분 표본으로 덮이는 위험을 줄였다.
  - invalidation parsed/rescue row 기본값을 300/80 -> 1000/1000으로 높였다.
  - `PIPELINE_MARKET_SCORE_DIRTY_BACKLOG_SKIP_LIMIT` 기본값을 1000 -> 0으로 바꿔 market recompute 후 stale `sku_median`/profit이 남지 않게 했다.

- `src/app/api/listings/[pid]/market-source/route.ts`
  - 비교 매물 표시 trimming이 `medianPrice`를 함께 받아 p25/p75보다 median anchor를 우선 고려한다.
  - blended/sold median이 active p75보다 높거나 낮은 경우에도 사용자가 시세 근거가 되는 샘플을 볼 수 있게 했다.

- `tests/market-invalidation-priority-contract.test.ts`
  - key chunk/row cap/dirty backlog skip 기본값 계약을 추가했다.

- `tests/detail-beginner-guide-contract.test.ts`
  - market-source proof list가 median anchor를 사용하는 계약을 추가했다.

## 운영 조치

- `shoe|airjordan_1_low|sneaker|a_grade` key를 high priority로 invalidation queue에 다시 넣고 새 로직으로 market stats를 재계산했다.
- `mark_scorable_score_dirty_by_comparable_keys` RPC로 같은 key의 scorable rows 439개를 dirty 처리했다.
- 대상 PID `9002454274782`는 `sku_median=64,500`, pool `invalidated_reason=negative_resell_gap` 상태로 확인했다.

## 검증

- `npx eslint src/lib/tick-pipeline.ts 'src/app/api/listings/[pid]/market-source/route.ts' tests/market-invalidation-priority-contract.test.ts tests/detail-beginner-guide-contract.test.ts`
- `npx tsx --test tests/market-invalidation-priority-contract.test.ts`
- `npx tsx --test --test-name-pattern "market source API trims price outliers" tests/detail-beginner-guide-contract.test.ts`
- `npm run build`

## 보류

- 전체 `tests/detail-beginner-guide-contract.test.ts`에는 이전 UI/copy 변경으로 인한 unrelated 계약 실패가 남아 있어 이번 wave에서는 targeted test만 확인했다.
- market invalidation backlog 9,000+ key는 별도 backlog drain/worker 분리 wave에서 처리한다.
