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

## Follow-up: score_dirty write coalescing

The first production run after deploy succeeded, but still spent 80.150s total and reported
`market_score_dirty_marked_rows=5000`.

Decision:

- Do not re-PATCH rows that are already `score_dirty=true`.
- Patch only `pid in (...) AND score_dirty=false`.
- Increase the numeric PID PATCH chunk for this path from 50 to 300.
- Split timing counters:
  - `market_score_dirty_candidate_rows`: parsed rows that could need rescoring.
  - `market_score_dirty_marked_rows`: rows actually flipped from false to true.

This preserves event-driven rescoring semantics while reducing duplicate writes and noisy backlog churn.

## Follow-up: smaller invalidation key chunks

A later production run still hit Supabase statement timeout on the parsed-row GET, even after dropping
`parsed_json`. The failing URL showed a 50-key `comparable_key in (...)` chunk.

Decision:

- Market invalidation parsed reads now use a default key chunk size of 10 instead of 50.
- Per-key-chunk row cap defaults to 300 instead of 1,000.
- The generic loader still defaults to 50-key chunks; this tighter setting is only for market invalidation.
- Track attempted keys and do not mark unattempted pending invalidations as `done` when the global row cap stops the read early.
- Added stage timings:
  - `market_invalidation_key_chunk_size`
  - `market_invalidation_attempted_keys`
  - `market_invalidation_deferred_keys`

Local REST probes against the current pending 500 keys showed 10-key chunks responding in roughly 60-200ms per chunk, while 50-key chunks had multi-second spikes and one production timeout.

## Follow-up: hot-key rescue and partial index

After the 10-key chunk deploy, one production run succeeded and a later run still timed out on an AirPods-heavy parsed-row GET. That means the issue is not only URL/chunk size; some high-volume comparable keys need either a narrower fallback or an index matching the market invalidation query shape.

Decision:

- `loadParsedRowsByComparableKeys` now retries a failed multi-key chunk one key at a time.
- If a single key still times out, the key is logged/deferred instead of failing the whole `market_worker` run.
- Market invalidation records `rescued` and `failed` key counts in stage timings.
- Added migration `20260529170352_market_invalidation_parsed_hotpath_index.sql`:
  - partial covering index on `(comparable_key, pid)`
  - predicate `needs_review is false and parse_confidence >= 0.65`
  - covers the selected parser/condition columns

This keeps the worker alive immediately and gives Postgres the right index for the hot path once the migration is applied.

## Follow-up: recovered-worker alert suppression

Source health still showed a `market_worker_failure_rate_critical` operational alert after the worker had recovered, because the 120-minute health window retained old failures.

Decision:

- Keep the 120-minute source-health window for status hysteresis.
- Suppress worker failure alerts when the latest runs for that worker have recovered with at least two consecutive successes.
- Ignore currently `running` rows when computing recovery streaks; a worker that just started is not a fresh failure.
- This removes stale alert noise while still leaving real recurring failures visible.

## Deferred

- If single-key rescue still leaves a permanent pending-key tail, add per-key attempt/error tracking or a stale-key quarantine policy.
- A deeper refactor could compute invalidation rows from recent `mvp_raw_listings` first, then join parsed PIDs, so stale historical rows are not considered at all.
