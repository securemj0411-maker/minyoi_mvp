# Wave 883 - Score hotpath and handoff after all-category cleanup

## Context

- User interrupted and asked for complete logs so another session can understand what happened.
- This log continues after `2026-05-25-wave881-current-replay-drain-y3-qasa-nb327.md` and `2026-05-25-wave882-all-category-current-sample-cleanup.md`.
- Full 14h master index and handoff is in `2026-05-26-wave884-14h-master-change-log.md`.
- Main concern before interruption:
  - Pool ready count had recovered from the emergency `82` state to `538`.
  - Catalog/parser/current-sample cleanup was applied, but score-stage dirty drain was still not reliably finishing under worker-like budget.
  - User wanted no silent rollback and no hidden `internal_only` mistake.

## What Was Already Applied Before This Log

- Y-3 QASA:
  - Clothing Y-3 matcher now blocks QASA/Kaiwa/Adios/Takumi shoe terms.
  - Shoe QASA matcher was broadened.
  - Backfilled:
    - `282211589` -> `shoe|y3_qasa_broad|sneaker|b_grade`
    - `398751123` -> `shoe|y3_qasa_broad|sneaker|c_grade`
- NB327 stale condition:
  - `172619812` updated to `shoe|newbalance_327_broad|sneaker|a_grade`.
- Fashion condition tier:
  - `UNKNOWN` now contributes `unknown_condition` to fashion comparable keys instead of falling through to the old default.
- Game/goods cleanup:
  - Cyberpunk/other game-title goods terms were added as noise.
  - `switch-game-lego` now requires game/platform terms so physical LEGO sets do not pollute game-title samples.
- Cross-category deep sweep diagnostic:
  - Reduced false positives for terms like loft/wedge/utility/hybrid that are legitimate fashion or non-golf contexts.
  - `needs_review=true` rows are no longer counted as actionable fashion tier/json/category conflicts.

## DB Work Completed Before This Log

- 5k current-replay sweep:
  - Found stale Mizuno golf rows that were misparsed as shoe.
  - Found fashion `UNKNOWN` condition tier drift.
  - Backfilled all 5k actionables.
  - Rerun result: `actionableRows=0`, `poolActionableRows=0`.
- 20k all-category sweep:
  - Initial actionable rows: `128`.
  - Parsed current reparse upserted: `125`.
  - Current catalog rejects removed: `3`.
  - Market invalidations queued: `104`.
- LEGO block cleanup:
  - `switch-game-lego` scanned: `70`.
  - Actual LEGO block/figure/set rows rejected from game samples: `67`.
  - Market invalidations queued: `1` key.
- Desired current-key drift cleanup:
  - Raw-key drift candidates: `1213`.
  - Parsed key updated: `833`.
  - Raw SKU synchronized: `347`.
  - Current catalog rejects removed: `17`.
  - Dirty marked: `1166`.
  - Market invalidations queued: `1006`.
- Tail cleanup:
  - Residual tier-column mismatch fixed: `5`.
  - Remaining Cyberpunk goods rejected: `15`.
  - Market invalidations queued: `20`.
- Final 20k sweep after cleanup:
  - `auditedRows=20000`
  - `flaggedRows=67`
  - `actionableRows=0`
  - `poolRowsReadyOrReserved=67`
  - `poolActionableRows=0`
  - Remaining flags are non-actionable raw-reparse drift diagnostics or one condition-class change.
- Market stats stage was run three times:
  - Claimed invalidation keys: `500 + 500 + 86`.
  - Pool upserted: `1991 + 2756 + 924`.
- Pool snapshot after market drain:
  - Total pool rows fetched: `6665`.
  - `ready=538`, `invalidated=6106`, `spent=21`.
  - Ready by category:
    - `shoe=169`
    - `clothing=146`
    - `earphone=59`
    - `smartphone=34`
    - `tablet=33`
    - `smartwatch=29`
    - `drone=20`
    - `sport_golf=9`
    - `game_console=4`

## Score Hotpath Diagnosis

- Earlier large score runs timed out before scoring:
  - Wrong flag run used default 90s because `--deadline-ms` was not recognized.
  - Correct `--budget-ms=180000` still timed out before scoring.
  - A later `--limit=2000 --budget-ms=180000` run exited with `scored=0`, `timedOut=true`.
  - Non-fatal timeout logs appeared for `loadFraudGroupHashes`.
- There were no lingering long-running processes when this log was written.
- Targeted REST timing probes:
  - `raw200`: `278ms`, 200 rows.
  - `parsed200`: `144ms`.
  - `market100-current`: `153ms`, 1000 rows.
  - `market100-cap800`: `221ms`, 800 rows.
  - `reference-prices`: `75ms`.
  - `low-volume-1000`: `5669ms`.
- Interpretation:
  - Query basics were fine.
  - Low-volume scan was a real fixed-cost drag.
  - Fraud group RPC was non-fatal but burned several seconds per score run.
  - Large score batches can still miss the deadline before reaching the row loop.

## Code Changes In This Follow-Up

- `src/lib/tick-pipeline.ts`
  - `loadLowVolumeSkuIds()`:
    - Added `order=first_seen_at.desc`.
    - Added bounded scan via `PIPELINE_LOW_VOLUME_MAX_ROWS`.
    - Default was first tried at `15000`, then changed to `1000` after worker-budget testing.
    - Reason: keep low-volume gate focused on the newest fashion/shoe/bag rows and avoid score-worker starvation.
  - `loadFraudGroupHashes()`:
    - Default timeout reduced from `5000ms` to `1500ms`.
    - Reason: the RPC is non-fatal; repeated 5s stalls made score-worker less likely to process rows under its 55s route budget.

## Score Verification After Hotpath Patch

- Small run:
  - Command: `PIPELINE_LOW_VOLUME_MAX_ROWS=1000 SUPABASE_REST_TIMEOUT_MS=10000 npx tsx --env-file=.env.local scripts/run-score-stage-once.ts --limit=50 --budget-ms=90000`
  - Result:
    - `scored=50`
    - `upserted=17`
    - `poolUpserted=5`
    - `poolSkipped=45`
    - `timedOut=false`
  - Top skip reasons:
    - `negative_resell_gap=21`
    - `profit_below_pack_band=12`
    - `sku_low_volume_below_2d1_or_7d3=10`
    - `sku_median_unavailable=2`
- Larger backfill run:
  - Command: `PIPELINE_LOW_VOLUME_MAX_ROWS=1000 SUPABASE_REST_TIMEOUT_MS=10000 npx tsx --env-file=.env.local scripts/run-score-stage-once.ts --limit=500 --budget-ms=120000`
  - Result:
    - `scored=449`
    - `upserted=364`
    - `poolUpserted=25`
    - `poolSkipped=424`
    - `timedOut=false`
    - `score_dirty_cleared_rows=500`
  - Top skip reasons:
    - `negative_resell_gap=172`
    - `sku_median_unavailable=113`
    - `sku_low_volume_below_2d1_or_7d3=39`
    - `profit_below_pack_band=33`
    - `price_above_pool_max=12`
- Worker-like budget run:
  - Command: `PIPELINE_LOW_VOLUME_MAX_ROWS=1000 SUPABASE_REST_TIMEOUT_MS=10000 npx tsx --env-file=.env.local scripts/run-score-stage-once.ts --limit=300 --budget-ms=55000`
  - Result:
    - `scored=0`
    - `timedOut=true`
  - Meaning: production score-worker default `tickScoreLimit=300` can still time out under 55s budget.
- Worker-like smaller run:
  - Command: `PIPELINE_LOW_VOLUME_MAX_ROWS=1000 SUPABASE_REST_TIMEOUT_MS=10000 npx tsx --env-file=.env.local scripts/run-score-stage-once.ts --limit=100 --budget-ms=55000`
  - Result:
    - `scored=95`
    - `upserted=56`
    - `poolUpserted=1`
    - `score_dirty_cleared_rows=95`
    - `timedOut=true`
  - Meaning: 100 rows does useful work under 55s, but still reports timeout near the tail. This is better than `scored=0`, but not fully clean.

## Current Interpretation

- The cleanup work was not a rollback or 헛수고:
  - Current catalog behavior, parsed rows, raw SKU, sample invalidation, and market stats were aligned.
  - Final 20k all-category sweep had zero actionable rows.
  - Pool recovered to `538` ready after market drain.
- The remaining issue is runtime throughput:
  - `score_dirty` backlog remains high.
  - Score worker can drain rows when batch size is small enough.
  - Production-like `limit=300` is too aggressive with current score-stage fixed costs.
- The hotpath patch is partial:
  - `PIPELINE_LOW_VOLUME_MAX_ROWS=1000` and fraud timeout `1500ms` improve latency.
  - Another session should either lower default `PIPELINE_TICK_SCORE_LIMIT` in config/env or split score cleanup/preload work further.

## Recommended Next Steps For Next Session

- Do not roll back parser/catalog/current-sample cleanup.
- Keep the low-volume bounded scan unless a DB-side aggregate/RPC replaces it.
- Next safe runtime fix:
  - Lower score-worker effective limit from `300` to around `80-100`, or set env `PIPELINE_TICK_SCORE_LIMIT=100`.
  - Re-run score-worker-like pass and confirm `timedOut=false`.
- Better structural fix:
  - Add stage timing around:
    - cleanup residue calls before `loadScorableRows`
    - `loadScorableRows`
    - `ensureParsedRows`
    - `loadMarketPriceStats`
    - `applyAiReview`
    - pool build/upsert/invalidation
  - Move residue cleanup to a separate worker or cap it lower when ready pool is healthy.
  - Replace `loadLowVolumeSkuIds()` client-side scan with a Supabase RPC aggregate by `sku_id`.
- After runtime fix:
  - Continue score drain in batches.
  - Re-check pool counts by status/category.
  - Re-run `report-cross-category-db-deep-sweep.ts --categories=all --limit=20000 --current-replay=pool --progress-every=5000`.

## Tests / Verification Already Run

- `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - Result: `81/81 passed`.
- Final all-category 20k sweep:
  - `actionableRows=0`
  - `poolActionableRows=0`
- Score hotpath verification:
  - 50-row run completed and scored.
  - 500-row backfill run completed and scored.
  - 300-row worker-budget run still failed before scoring.
  - 100-row worker-budget run scored 95 rows but still ended with `timedOut=true`.

## Handoff Notes

- Current date when this handoff was written: 2026-05-26 KST.
- No long-running script process was found when checked with `ps`.
- Worktree is very dirty from many previous waves. Do not revert unrelated files.
- The code changes in this specific hotpath follow-up are only in `src/lib/tick-pipeline.ts`.
- The user explicitly wants logs under `docs/DECISIONS/` and does not want `30일_실행계획.md` used as an append-only work log.
