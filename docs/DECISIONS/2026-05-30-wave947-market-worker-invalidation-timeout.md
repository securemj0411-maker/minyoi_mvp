# Wave 947 — Market Worker Invalidation Timeout Guard

Date: 2026-05-30 KST

## Context

Telegram source-health alerts still showed `market_worker` failures after the deep-crawl runtime fix.
Recent failed runs errored on `GET /rest/v1/mvp_listing_parsed?...comparable_key=in.(...)`.

Runtime inspection:

- `mvp_market_key_invalidation`: 1,958 pending keys.
- First 500 claimed keys were split into 10 chunks of 50.
- The first 50-key chunk matched 10,704 parsed rows.
- Existing loader could read up to `marketStatsLimit=8000` rows from a single hot chunk, including `parsed_json`.

This made one popular SKU family able to consume most of the worker runtime and intermittently trip Supabase/PostgREST 500s.

## Decision

Keep market invalidation recomputation, but make the parsed-row read lighter and fairer:

- Market invalidation reads now omit `parsed_json` and select `condition_notes` directly.
- Comparable-key and shoe-sibling loaders accept `maxRowsPerKeyChunk`.
- Market invalidation path defaults to 1,000 parsed rows per 50-key chunk.
- Shoe sibling wildcard path is capped at 500 rows per pattern.
- `markRawScoreDirtyByComparableKeys` uses the same light/capped loader because it only needs PIDs.
- Added stage timings:
  - `market_invalidation_parsed_rows_per_key_chunk`
  - `market_invalidation_parsed_rows`
  - `market_invalidation_sibling_rows`

## Verification

- REST timing against current pending 500 keys with the new cap:
  - 8,221 rows across 10 chunks.
  - 9.165s total.
- `npx eslint src/lib/tick-pipeline.ts`
  - Passed with existing warnings only:
    - `trimmedSellerMarket` unused.
    - `MARKET_INVALIDATION_FAST_LANE_PREFIXES` unused.
- `npm run build`
  - Passed.

`npx tsc --noEmit --pretty false` was also tried, but the repo has pre-existing unrelated test type errors in older tests (`daangn-source-probe`, fake-floor tests, AI L2 shadow audit imports, etc.).

## Deferred

- If market-worker still spikes after this cap, consider a DB index optimized for the exact invalidation query:
  `(comparable_key, needs_review, parse_confidence desc, pid)`.
- A deeper refactor could compute invalidation rows from recent `mvp_raw_listings` first, then join parsed PIDs, so stale historical rows are not considered at all.
