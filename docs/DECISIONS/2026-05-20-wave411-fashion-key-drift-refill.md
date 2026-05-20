# 2026-05-20 Wave411 — fashion key-drift refill

## 배경

Wave410에서 `mvp_candidate_pool.comparable_key`가 current parser 결과와 다른 fashion pool row 72개를 `wave410_pool_key_drift`로 invalidated 처리했다.
다만 `scoreStage`는 `score_dirty=true`인 raw row만 처리하고, parser version drift가 아닌 같은 버전 내 comparable-key drift는 자동으로 재채점되지 않는다.
따라서 old key를 제거한 뒤 current parser key로 다시 pool 후보를 태우는 refill 단계가 필요했다.

## 결정

- `scripts/refill-fashion-key-drift-pool.ts`를 추가했다.
  - `mvp_candidate_pool.status=invalidated`, `invalidated_reason=wave410_pool_key_drift` row를 읽는다.
  - current `ruleMatch` + `parseListingOptions`로 `mvp_listing_parsed`를 upsert한다.
  - raw row를 `score_dirty=true`로 표시하고, 옵션으로 `scoreStage`까지 실행한다.
- refill dry-run 중 `코치넬레`가 `Coach` broad bag fallback으로 오인되는 것을 발견했다.
  - `src/lib/generated/catalog-wave266-bag.ts`의 Coach broad `mustNotContain`에 `coccinelle`, `코치넬레`를 추가했다.
  - `tests/wave254-6-product-type-priority.test.ts`에 regression test를 추가했다.
- `scoreStage`에서 current clothing SKU를 쓰기 위해 추가했던 `effectiveSku`가 second scoring loop scope 밖에서 참조되던 런타임 버그를 수정했다.

## 실행 결과

- dry-run: invalidated 72개 중 current parser로 71개 reparse 가능.
  - 제외된 1개는 `코치넬레` false positive 차단 결과.
- apply + score:
  - reparsed rows: 71
  - scored: 28
  - pool upsert writes: 6
  - pool skip: 22
    - `sku_median_unavailable`: 18
    - `profit_below_pack_band`: 2
    - `negative_resell_gap`: 2
- 재채점 후 broad clothing lane (`polo_apparel_broad`) 1개가 다시 active pool에 올라와 즉시 gate cleanup으로 invalidated 처리했다.

## 최종 상태

- `reports/fashion-pool-purity-latest.json`
  - active fashion pool rows: 50
  - clothing: 30
  - bag: 10
  - shoe: 10
  - gate-blocked rows: 0
  - flagged rows: 0
  - actionable rows: 0
- `reports/fashion-pool-gate-cleanup-dry-run-latest.json`
  - candidateRows: 0

## 추가 처리 — Bottega Cassette key drift

- Wave411 중 남은 `raw_sku_now_null` 2건을 확인하다가 Bottega Cassette active pool row 3개가 old comparable key를 쓰는 것을 발견했다.
- 원인:
  - `bag-bottega-cassette-mini` narrow SKU와 `bag-bottega-broad` fallback이 동시에 matching되어 `ruleMatch`가 null을 반환했다.
  - description의 "쇼핑백/파우치 등 구성품" 문구가 bag product type을 `tote`/`pouch`로 오염시켜 `crossbody` key가 흔들렸다.
- 조치:
  - Bottega broad fallback에서 `cassette`/`카세트`를 제외해 Cassette narrow가 단독 matching되게 했다.
  - Bottega Cassette bag은 wallet 계열이 아닌 `카세트백/크로스백` 문구가 있으면 구성품 `쇼핑백/파우치`에 흔들리지 않고 `crossbody`로 고정했다.
  - old-key active row 3개를 `wave410_pool_key_drift`로 invalidated 처리하고 refill+score를 재실행했다.
- 재실행 결과:
  - invalidated rows: 75
  - reparsed rows: 74
  - scored: 108
  - pool upsert writes: 9
  - score dirty cleared: 124
  - final active pool: 50, flagged/actionable/gate-blocked 모두 0

## 검증

- `npx tsx --test tests/core-rules.test.ts tests/wave254-5-fashion-condition.test.ts tests/fashion-catalog-regression.test.ts tests/wave254-6-product-type-priority.test.ts`
  - 174 pass / 0 fail
- `git diff --check`
  - pass

## 보류

- 전체 fashion `score_dirty` 큐에는 과거 dirty row가 많이 남아 있다.
  - 이번 wave의 목적은 Wave410 key-drift refill과 active pool purity 회복이므로 전체 dirty queue drain은 별도 작업으로 남긴다.
