# 2026-05-29 Wave 939 — Score worker scorable fetch split

## Context

After Daangn A/B/C score sharding, B and C score workers were stable, but the primary A score worker still showed intermittent Supabase statement timeouts while loading raw scorable rows.

The failing request was the first raw scoring fetch against `mvp_raw_listings`, not the dirty pool refresh helper patched in Wave 937.

Recent observed state:

- total ready: about `3,515`
- raw `score_dirty`: about `101k`
- Daangn dirty rows that are already detail-done and normal: about `4,083`
- Daangn raw last_seen in 1h: about `17.9k`
- Daangn raw last_seen in 6h: about `61.5k`

The backlog is large enough that occasional query plan spikes can matter even if the average query is fast.

## Decision

Do not add another score worker or loosen quality gates.

Instead, simplify the raw scorable fetch:

- before: one PostgREST query with `or=(listing_type.eq.normal,listing_type_override.eq.normal)`
- after: two narrow queries:
  - `listing_type=eq.normal`
  - `listing_type_override=eq.normal`

The results are still deduped in JS through the existing `seenPids` set and then filtered by source/shard scope.

Why:

- The current production OR query is usually fast, but the recent failures are statement-timeout spikes under Daangn backlog pressure.
- Splitting the predicate keeps each query more index-friendly and avoids a broad OR plan.
- It does not increase marketplace fetches.
- It does not change candidate quality policy.
- It avoids a schema/index change until repeated failures prove one is needed.

Also added `last_seen_at` to the selected columns so the scorable row shape matches `RawListingRow` again.

## Verification

- `npx eslint src/lib/tick-pipeline.ts`
  - passed with existing unrelated warnings only:
    - `trimmedSellerMarket` unused
    - `MARKET_INVALIDATION_FAST_LANE_PREFIXES` unused
- `npx tsx --test tests/wave249-pool-builder-clamp-fix.test.ts`
  - 13 pass, 0 fail
- `npm run build`
  - passed

Production deploy verification:

- A `minyoi-mvp` auto-deployed commit `44e1d33c`.
- B `minyoi-mvp-atff` auto-deployed commit `44e1d33c`.
- C `minyoi-mvp-daangn-c` does not auto-deploy from Git, so it was deployed from a clean detached worktree at `44e1d33c`.
- Forced production score runs after deploy:
  - A `/api/cron/score-worker?force=1&cleanup=0`: ok, `score_rows_loaded=100`, `score_load_rows=764ms`
  - B `/api/cron/score-worker-b?force=1`: ok, `score_rows_loaded=90`, `score_load_rows=3262ms`
  - C `/api/cron/score-worker-c?force=1`: ok, `score_rows_loaded=100`, `score_load_rows=2582ms`

## Deferred

If A score worker failures continue after this deploy, next options are:

1. add a dedicated DB-side RPC for the scorable candidate claim
2. add/adjust a partial index for the score dirty scorable query
3. reduce A generic reserve work if B/C Daangn shards already cover enough

Do not increase score row limit until the raw fetch path is stable.
