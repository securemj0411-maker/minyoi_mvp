# 2026-05-29 Wave 914 — Daangn ready promotion market refresh bottleneck

## Context

The operator reported that Daangn ready count is not rising fast enough and wants throughput closer to 1,000+ ready candidates/day.

Production review after A/B/C discovery and detail workers showed that raw Daangn ingestion is active, but score promotion is still heavily blocked by market-stat readiness:

- Daangn raw rows with `active + sku_id`: high volume.
- Recent detail worker successfully patched manner temperature, but newly enriched rows did not automatically enqueue market-stat recomputation.
- Recent score workers still showed many `sku_median_unavailable` skips.
- Recent `daangn-price-sweep-worker` keyword/category sample sweep was blocked and returned `fetchedArticles=0`, so it cannot be the only source-market sample filler.

## Findings

1. Discovery is not the only bottleneck.
   - A/B/C workers are collecting large Daangn pages.
   - The ready count stalls because many rows reach score before their Daangn source-market median exists.

2. Detail enrichment did not wake market-stat recomputation.
   - `daangn-detail-worker` patched `mvp_raw_listings` with `daangn_manner_temperature`, `detail_status=done`, and `score_dirty=true`.
   - It did not enqueue `mvp_market_key_invalidation`.
   - Result: score can retry before per-source market stats are refreshed, then invalidate again as `sku_median_unavailable`.

3. The `sku_median_unavailable` recovery path was too narrow.
   - It only queried `category in (clothing, shoe, bag)`.
   - Daangn electronics/earphone/phone/tablet SKUs could stay stuck even when source samples were available or recoverable.

4. Market refresh cadence was too slow for Daangn volume.
   - `/api/cron/market-worker` ran every 30 minutes.
   - `/api/cron/tick` recent runs often finished after `search` only, so it should not be relied on for frequent market-stat refresh under high discovery load.

## Decisions

1. Do not loosen ready quality gates first.
   - `sku_median_unavailable` should mean "refresh source market stats faster", not "show low-confidence rows".

2. Connect detail enrichment directly to source-market refresh.
   - After successful Daangn detail backfill or 404/410 state change, enqueue market invalidations for the row's parsed comparable key.
   - Use higher priority for Daangn detail-backed refresh events.

3. Expand `sku_median_unavailable` recovery to all categories.
   - Remove the clothing/shoe/bag-only filter.
   - Prioritize Daangn rows as source-specific market refresh work.

4. Increase market-worker cadence from 30 minutes to 10 minutes.
   - The existing cron guard keeps duplicate runs from overlapping.
   - This is safer than using blocked keyword sweep as the only recovery path.

## Implemented

- `src/lib/daangn-detail-backfill.ts`
  - Added market invalidation enqueue after successful detail patch and gone-state patch.
  - Added `marketInvalidationsQueued` result metric.

- `src/app/api/cron/daangn-detail-worker/route.ts`
  - Added `marketInvalidationsQueued` to collect-run stage stats.

- `src/lib/tick-pipeline.ts`
  - Removed category restriction from `sku_median_unavailable` recovery.
  - Added Daangn-specific reason/priority for source-market refresh.

- `vercel.json`
  - Changed `/api/cron/market-worker` from every 30 minutes to every 10 minutes.

- `src/lib/cron-guard.ts`
  - Reduced `market_worker` cooldown from 10 minutes to 8 minutes.
  - Reason: a market-worker run often takes 40-60 seconds, so a strict 10-minute cooldown can cause the next 10-minute cron tick to skip.

## Expected Effect

This does not magically make every Daangn row ready. `negative_resell_gap` and true low-profit rows should still be filtered.

It should raise ready throughput by preventing recoverable Daangn rows from sitting in `sku_median_unavailable` after detail/manner enrichment. The next measurable target is:

- fewer `sku_median_unavailable` skips in score-worker logs;
- more pending/done market invalidation rows for Daangn comparable keys;
- higher Daangn `poolUpserted` count after the next few market-worker + score-worker cycles.

## Production Verification

After the first deployment:

- `daangn-detail-worker` ran with `patched=38` and `marketInvalidationsQueued=36`.
- The next `market-worker` claimed `129` market invalidation keys and marked `5000` rows dirty for score refresh.
- Daangn ready count moved from `445` to `453` after the first market/score cycle.
- `daangn_detail_backfill` invalidations moved to `done`, confirming the new queue path is live.

Follow-up issue:

- The 10-minute `market-worker` cron tick can be skipped by the previous 10-minute cooldown because the worker duration counts against the interval.
- The cooldown was lowered to 8 minutes so the 10-minute cadence can actually execute.

## Wave 914b Follow-up

Production after the first fix showed the pipeline was moving, but too slowly:

- Last 2 hours:
  - Daangn discovery upserted `6,989` raw rows.
  - Daangn detail worker patched `382` rows and queued `268` market invalidations.
  - Score workers promoted `70` rows to pool but skipped many candidates.
- Top score blockers:
  - `negative_resell_gap`: expected/non-actionable quality filter.
  - `sku_median_unavailable`: still too high.
  - `daangn_manner_temperature_missing`: detail worker still racing behind score workers.

Implemented follow-up:

- Fixed Daangn per-source market stat selection to use `trustedMarketMedian(...)` instead of hard-cutting `sample < 3`.
  - Existing policy already allows thin categories such as clothing/shoe/bag at `sample >= 2`.
  - The old per-source picker cut those rows before the policy could apply.
- Made recovery for invalidated rows source-aware.
  - Daangn `sku_median_unavailable` recovery now checks Daangn per-source stats instead of mixed stats.
- Increased Daangn detail worker default throughput:
  - `limit`: `45` → `70`
  - `budgetMs`: `50s` → `80s`
  - `delayMs`: `700ms` → `550ms`

Expected effect:

- Clothing/shoe/bag Daangn rows with 2 trusted source samples should stop dying at `sku_median_unavailable`.
- Rows with one weak condition sample but a trusted adjacent fallback condition should recover instead of staying invalidated.
- Manner temperature backlog should drain faster without changing ready quality thresholds.

## Deferred

- Aggressive category-only Daangn crawling across more Vercel projects is deferred until this ready-promotion bottleneck is measured.
- Relaxing Daangn source median sample requirements is deferred because it would increase ready count at the cost of trust.
- Rewriting price-sweep fallback is deferred because current production blocking suggests search-combo sweep is less reliable than using already-ingested Daangn raw rows plus market refresh.
