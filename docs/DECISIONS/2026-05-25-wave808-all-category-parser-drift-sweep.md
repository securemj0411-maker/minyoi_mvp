# Wave 808 — all-category parser drift sweep and queue recovery

**Date**: 2026-05-25 KST

## User concern

신발/의류뿐 아니라 골프, 게임기, 전자기기 등 전체 카테고리에서 parser/catalog/pool 매칭 오판이 반복될 수 있음. 오래 걸려도 전체 DB를 보고 안전하게 보강해야 함.

## Diagnosis

Added all-category funnel report:

- Report: `reports/all-category-funnel-latest.md`
- JSON: `reports/all-category-funnel-latest.json`

Catalog categories: `21`

Initial all-category funnel snapshot:

- raw rows matched to catalog SKU: `84,674`
- parsed rows: `112,520`
- candidate pool rows: `6,078`

Top parser mismatch before broad requeue:

| category | mismatch | parsed | expected |
|---|---:|---:|---|
| clothing | 16,044 | 17,849 | `wave216-clothing-v52` |
| shoe | 15,304 | 23,137 | `wave92-shoe-v41` |
| smartphone | 7,278 | 8,215 | `option-parser-v61` |
| earphone | 5,370 | 6,015 | `option-parser-v61` |
| tablet | 5,347 | 5,868 | `option-parser-v61` |
| bag | 4,620 | 6,156 | `wave92-bag-v24` |
| smartwatch | 4,432 | 4,697 | `option-parser-v61` |
| laptop | 2,915 | 3,177 | `option-parser-v61` |
| sport_golf | 1,346 | 1,589 | `option-parser-v61` |
| game_console | 1,259 | 1,931 | `option-parser-v61` |

Root cause:

- `option-parser.ts` latest is `option-parser-v61`.
- `LATEST_PARSER_VERSION_BY_CATEGORY` still had old `option-parser-v55` literals for several generic categories.
- Many categories using generic parser were missing from the drift map entirely (`sport_golf`, `game_console`, `camera`, `monitor`, `speaker`, `desktop`, etc.).
- `parserDriftStage` also fetched Supabase without `serviceHeaders()`, so the automatic drift marker could fail with missing API key depending on request path.

This reproduced the same class of issue as shoe/clothing:

- fresh parser output can be treated as stale when expected target is stale.
- unmapped categories can retain stale parsed rows forever.
- ready pool rows can keep old comparable keys after parser axis expansion.

## Fix Applied

1. `src/lib/tick-pipeline.ts`
   - Import `PARSER_VERSION as OPTION_PARSER_VERSION` from `option-parser`.
   - Generic parser categories now map to `OPTION_PARSER_VERSION` instead of stale literals:
     - `camera`, `desktop`, `drone`, `earphone`, `game_console`, `home_appliance`, `kickboard`, `laptop`, `lego`, `monitor`, `perfume`, `smartphone`, `smartwatch`, `speaker`, `sport_golf`, `tablet`, `watch`.
   - `parserDriftStage` Supabase read now passes `serviceHeaders()`.

2. `tests/fashion-parser-version-sync.test.ts`
   - Expanded drift-sync regression to assert generic parser categories follow `OPTION_PARSER_VERSION`.
   - Added assertion that `parserDriftStage` uses service headers.

3. Added operational scripts:
   - `scripts/report-all-category-funnel.ts`
   - `scripts/apply-all-category-parser-drift-requeue.ts`
   - `scripts/run-parser-drift-stage-once.ts`

4. Reused existing cross-category tools:
   - `scripts/report-cross-category-db-deep-sweep.ts`
   - `scripts/apply-cross-category-current-reparse-cleanup.ts`
   - `scripts/apply-cross-category-tier-backfill-batch.ts`

## DB Actions Applied

Parser drift stage after mapping fix marked stale rows dirty:

- shoe `1,000`
- bag `1,000`
- clothing `1,000`
- bike `6`
- camera `133`
- desktop `258`
- drone `463`
- earphone `1,000`
- game_console `1,000`
- home_appliance `301`
- kickboard `1`
- laptop `1,000`
- lego `94`
- monitor `80`
- perfume `248`
- smartphone `1,000`
- smartwatch `1,000`
- speaker `221`
- sport_golf `1,000`
- tablet `1,000`
- watch `571`

Direct all-category drift requeue:

- First apply patched `9,442` newly dirty rows.
- Final apply patched `293` newly dirty rows.
- Total newly dirty via direct all-category requeue: `9,735`.

Golf/game ready cleanup:

- Dry-run found `3` ready `sport_golf` rows whose current parser key had expanded to loft/shaft/sex/set axes.
- Applied cleanup:
  - refreshed parsed rows
  - marked raw dirty
  - invalidated old ready pool rows
  - no remaining sport_golf/game_console ready cleanup candidates after apply.

Market stats:

- limit `5,000`
- claimed pending keys `500`
- upserted market daily rows `1,365`
- sample count `4,789`
- marked raw score_dirty `5,000`
- stale lane-blocked rows requeued `7`

Score batches after all-category fix:

| run | scored | output upserted | pool upserted | dirty cleared | top skip pattern |
|---|---:|---:|---:|---:|---|
| post-drift batch 1 | 954 | 710 | 92 | 1,000 | `sku_median_unavailable`, `negative_resell_gap`, `profit_below_pack_band` |
| post-market batch 2 | 963 | 753 | 76 | 1,000 | `negative_resell_gap`, `sku_median_unavailable`, `profit_below_pack_band` |
| post-final batch 3 | 984 | 652 | 74 | 1,000 | `negative_resell_gap`, `sku_median_unavailable`, `profit_below_pack_band` |

Important: `stale_parser_version_*` disappeared from the score-stage top skip reasons after the mapping fix. Remaining blockers are mostly market/profit/quality gates.

Latest all-category funnel snapshot:

- raw rows matched to catalog SKU: `84,774`
- parsed rows: `112,629`
- candidate pool rows: `6,109`

Ready counts after reprocessing started:

| category | ready |
|---|---:|
| shoe | 18 |
| clothing | 6 |
| smartphone | 10 |
| bag | 3 |
| earphone | 16 |
| tablet | 8 |
| laptop | 2 |
| smartwatch | 4 |
| sport_golf | 2 |
| game_console | 3 |
| drone | 3 |
| home_appliance | 2 |
| desktop | 5 |
| speaker | 8 |
| camera | 1 |

## Interpretation

- 전체 카테고리 수집 자체가 주 병목은 아님.
- parser drift는 전 카테고리에 실제로 컸고, 특히 `option-parser-v55` 기대값/누락 mapping이 큰 원인이었음.
- 지금은 stale parser blocker가 풀려서, 다음 병목이 `sku_median_unavailable`, `negative_resell_gap`, `profit_below_pack_band`, seller/comment/qty gates로 이동했음.
- ready 숫자가 일시적으로 낮아 보이는 것은 stale/old-key ready를 걷고 최신 parser/market 기준으로 다시 태우는 과정 때문.

## Verification

Passed:

```bash
npx tsx --test tests/fashion-parser-version-sync.test.ts tests/wave254-5-fashion-condition.test.ts tests/fashion-catalog-regression.test.ts
```

Result: `63/63 pass`.

Operational reports/scripts executed successfully:

- `npx tsx scripts/report-cross-category-db-deep-sweep.ts --categories=clothing,shoe,sport_golf,game_console --limit=120000 --include-review=true --current-replay=pool --progress-every=5000`
- `npx tsx scripts/report-all-category-funnel.ts`
- `npx tsx scripts/apply-all-category-parser-drift-requeue.ts --apply`
- `npx tsx scripts/run-parser-drift-stage-once.ts --budget-ms=180000`
- `npx tsx scripts/run-market-stats-stage-once.ts --limit=5000`
- `npx tsx scripts/run-score-stage-once.ts --limit=1000 --budget-ms=300000`

## Deferred / Next

- Continue draining the already-marked score_dirty backlog through controlled score batches or normal cron.
- Run market stats again when `sku_median_unavailable` remains high.
- Do not loosen `negative_resell_gap` / `profit_below_pack_band` until ready purity is stable; these are economic gates, not parser bugs.
- Separate follow-up: evaluate whether `get_fraud_group_hashes` DB function needs an index/function rewrite. It now fails fast in score-stage, but the RPC itself still times out.
