# Wave 807 — shoe/clothing inflow funnel diagnosis + parser drift sync fix

**Date**: 2026-05-25 KST

## User concern

신발/의류가 raw 로는 많이 들어오는 것 같은데 ready pool 에 너무 적게 보임. 사용자 코멘트가 달린 매물도 함께 보고 원인을 찾아야 함.

## Diagnosis

Read-only DB funnel report:

- Report: `reports/shoe-inflow-funnel-latest.md`
- JSON: `reports/shoe-inflow-funnel-latest.json`

Key numbers:

| category | raw matched | raw eligible | seen 7d | ready | eligible invalidated | eligible no pool row |
|---|---:|---:|---:|---:|---:|---:|
| shoe | 23,259 | 19,228 | 22,194 | 30 | 599 | 18,599 |
| clothing | 17,958 | 15,469 | 17,914 | 77 | 437 | 14,955 |

Conclusion: 신발이 수집 안 되는 문제가 아님. raw/eligible 은 충분히 많고, pool entry 생성/재평가 쪽에서 대부분 대기 또는 차단됨.

## Root Cause 1 — parser version drift target mismatch

Production parser output:

- shoe parser emits `wave92-shoe-v41`
- clothing parser emits `wave216-clothing-v52`

But runtime drift gate/debug reparse target was stale:

- shoe expected `wave92-shoe-v39`
- clothing expected `wave216-clothing-v47`

Impact:

- Latest parsed rows could be invalidated as `stale_parser_version_shoe` / `stale_parser_version_clothing`.
- Example from user feedback sample: pid `399607840` had `parser_version=wave92-shoe-v41` but pool invalidated with `stale_parser_version_shoe`.
- Current fixed-target stale backlog remains large: shoe eligible stale-backlog `11,881`, clothing eligible stale-backlog `15,000`. This should be reprocessed through drift/score stages, not manually exposed.

## Root Cause 2 — score/pool backlog, not raw shortage

Most eligible rows do not have a candidate_pool row yet:

- shoe eligible no pool row: `18,599`
- clothing eligible no pool row: `14,955`

Many rows are already queued dirty:

- shoe score_dirty: `17,210`
- clothing score_dirty: `10,596`

This points to score-worker / pool-builder backlog plus strict gates, not search acquisition failure.

## Root Cause 3 — strict market gates still dominate after version fix

Top shoe invalidation reasons:

- `sku_median_unavailable`: 223
- `stale_parser_version_shoe`: 82
- `profit_below_pack_band`: 76
- `negative_resell_gap`: 70

Top clothing invalidation reasons:

- `profit_below_pack_band`: 264
- `stale_parser_version_clothing`: 65
- `negative_resell_gap`: 58
- `sku_median_unavailable`: 57

After version sync, stale reasons should requeue. Remaining `sku_median_unavailable` / profit gates are intentional precision gates and need separate policy decision if recall should be increased.

## Search cadence note

`category:405` shoe category sweep is intentionally limited to 3 pages in the regular freshness loop after Wave 288. This prevents shoes from monopolizing public freshness, but current data shows raw shoe volume is still high enough. The bigger issue is downstream pool conversion.

## Fix Applied

1. `src/lib/tick-pipeline.ts`
   - latest parser target updated:
     - shoe: `wave92-shoe-v39` -> `wave92-shoe-v41`
     - clothing: `wave216-clothing-v47` -> `wave216-clothing-v52`
   - stale parser invalidation recovery now requeues rows whose current invalidated reason is `stale_parser_version_${category}` or `stale_parser_version_${category}_residue`.

2. `src/app/api/debug/reparse-listings/route.ts`
   - category-specific legacy reparse target updated to shoe v41 / clothing v52.

3. `tests/fashion-parser-version-sync.test.ts`
   - New regression test ensures parser output, tick-pipeline drift gate, and debug reparse route stay synced.

4. `tests/wave254-5-fashion-condition.test.ts`
   - Updated stale version expectations to current parser versions.

## 2026-05-25 follow-up execution

After the initial fix, performed targeted write-side recovery instead of exposing stale rows directly:

1. Added `scripts/apply-fashion-parser-drift-requeue.ts`
   - Finds shoe/clothing rows where parsed parser_version is behind latest target, or pool invalidated reason is stale parser drift.
   - Filters to raw eligible rows only.
   - Patches only `mvp_raw_listings.score_dirty=true`.
   - First apply marked `7,620` additional rows dirty:
     - shoe newly dirty: `2,279`
     - clothing newly dirty: `5,336`

2. Added score-worker fashion reserve lane in `loadScorableRows`
   - Reserves up to 35% of score-stage capacity for dirty `shoe-*` / `clothing-*` SKU rows.
   - Prevents large general dirty backlog from starving fashion parser-drift backfills.

3. Added `scripts/run-score-stage-once.ts`
   - Local operational runner that loads env before dynamic importing `scoreStage`.
   - Shadow audit disabled for bulk backfill runs; normal score-stage AI review remains enabled.

4. Added bounded fallback for optional fraud hash RPC
   - `get_fraud_group_hashes` was repeatedly hitting DB statement timeout before falling back empty.
   - Added `PIPELINE_FRAUD_GROUP_HASH_TIMEOUT_MS` client timeout, default `5s`, so backfills do not wait for the long DB timeout when this optional guard is unavailable.

5. Fixed market-worker lane-blocked cleanup header
   - `markStaleLaneBlockedScoreDirty` was missing `serviceHeaders()` and produced a non-fatal 401 during market stats.

6. Added `scripts/run-market-stats-stage-once.ts`
   - Local operational runner for `marketStatsStage`.

## Execution results

Score-stage batches run after requeue:

| run | limit | scored | output upserted | pool upserted | dirty cleared | timed out |
|---|---:|---:|---:|---:|---:|---|
| initial 90s smoke | 1,000 | 0 | 0 | 0 | 0 | yes |
| post-reserve small | 300 | 289 | 220 | 38 | 300 | no |
| post-reserve bulk 1 | 1,000 | 937 | 628 | 61 | 1,000 | no |
| post-fraud-timeout bulk 2 | 1,000 | 921 | 602 | 73 | 1,000 | no |
| post-market-stats bulk 3 | 1,000 | 978 | 725 | 41 | 1,000 | no |

Market stats run:

- Claimed pending invalidation keys: `500`
- Shoe keys: `186`
- Clothing keys: `258`
- Market daily rows upserted: `155`
- Sample count: `2,273`
- Raw rows re-marked dirty by recomputed comparable keys: `3,791`
- Reveal current profit updated: `23`
- Reveal current profit invalidated: `5`

Additional requeue after batches marked `338` rows dirty:

- shoe newly dirty: `2`
- clothing newly dirty: `334`

Latest funnel snapshot after these runs:

| category | raw matched | raw eligible | seen 7d | ready | eligible invalidated | eligible no pool row |
|---|---:|---:|---:|---:|---:|---:|
| shoe | 23,274 | 19,243 | 22,201 | 10 | 628 | 18,605 |
| clothing | 17,931 | 15,442 | 17,887 | 19 | 520 | 14,903 |

Interpretation:

- Search acquisition is still not the bottleneck.
- The first fix intentionally invalidated stale/impure ready rows, so ready count briefly dropped to zero before reprocessed rows started coming back.
- Market stats helped: score skip reason `sku_median_unavailable` dropped in live score-stage skip mix from ~270-305 per 1k run to `156` after market recompute.
- Remaining pool blockers are now mostly legitimate economic gates (`negative_resell_gap`, `profit_below_pack_band`) plus residual `sku_median_unavailable` / stale-parser backlog.

## Verification

Passed:

```bash
npx tsx --test tests/fashion-parser-version-sync.test.ts tests/wave254-5-fashion-condition.test.ts tests/fashion-catalog-regression.test.ts
```

Result after follow-up changes: 63/63 pass.

## Deferred / Next

- Continue draining score_dirty backlog through normal score-worker or controlled local batches.
- Run market stats again if `sku_median_unavailable` remains the top blocker for shoe/clothing.
- Do not blindly loosen `profit_below_pack_band` or `negative_resell_gap` yet. Those are precision gates and need a recall-vs-quality decision.
- After further batches, rerun `scripts/report-shoe-inflow-funnel.ts` and verify:
  - `stale_parser_version_shoe/clothing` invalidations decrease.
  - eligible no-pool backlog drains.
  - ready shoe/clothing counts rise without purity regression.
