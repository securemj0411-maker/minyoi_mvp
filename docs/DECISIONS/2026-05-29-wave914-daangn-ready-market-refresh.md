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

## Expected Effect

This does not magically make every Daangn row ready. `negative_resell_gap` and true low-profit rows should still be filtered.

It should raise ready throughput by preventing recoverable Daangn rows from sitting in `sku_median_unavailable` after detail/manner enrichment. The next measurable target is:

- fewer `sku_median_unavailable` skips in score-worker logs;
- more pending/done market invalidation rows for Daangn comparable keys;
- higher Daangn `poolUpserted` count after the next few market-worker + score-worker cycles.

## Deferred

- Aggressive category-only Daangn crawling across more Vercel projects is deferred until this ready-promotion bottleneck is measured.
- Relaxing Daangn source median sample requirements is deferred because it would increase ready count at the cost of trust.
- Rewriting price-sweep fallback is deferred because current production blocking suggests search-combo sweep is less reliable than using already-ingested Daangn raw rows plus market refresh.
