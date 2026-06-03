# Wave 1029 — Score-worker pid-first scorable load

Date: 2026-06-03

## Context

Telegram alerts on 2026-06-03 KST showed repeated `score_worker` failures:

- 12:22 KST: `score_worker` 22% failure
- 18:52 KST: `score_worker` 7% failure
- 19:12 KST: `score_worker` 16% failure

This was not alert noise. Recent `mvp_collect_runs` rows showed real failed
score-worker runs with `scored_count=0`.

## Finding

The common failure was Supabase/Postgres statement timeout:

- table: `mvp_raw_listings`
- path: score-worker scorable raw row load
- error: `57014 canceling statement due to statement timeout`
- failed runs lasted about 26-38s and scored zero rows

The previously logged Wave 1015 fix made the broken RPC opt-in and verified the
REST fallback was fast at that moment. It did not permanently eliminate the
remaining intermittent risk: the fallback still selected wide raw-listing
columns while ordering by `last_seen_at`.

## Change

`loadScorableRows()` now uses a two-phase REST fallback when `score_dirty` is
available and the score-claim RPC is disabled:

1. skinny claim query:
   - `select=pid,source`
   - keeps existing `score_dirty/detail_status/sku_id/listing_state/source/listing_type`
     filters and `last_seen_at.desc` ordering
2. full hydration query:
   - fetches the existing wide score columns only by `pid=in.(...)`
   - chunks hydration at 100 pids
   - preserves claim ordering before normal JS dedupe/gates

The existing policies remain unchanged:

- source reserve order remains pool → Daangn → fashion → Joongna → Bunjang
- Daangn shard filtering remains in `scoreStageScope`
- candidate quality, pool gates, and score_dirty clearing are unchanged
- no schema or marketplace-fetch increase

## Production Read Probe

Non-mutating Supabase REST probe against production data:

- pid-first Daangn normal claim, 300 rows: `1526ms`
- hydrate 100 claimed pids with full score columns: `354ms`

This verifies the new access pattern avoids the wide sorted raw query that was
timing out in failed runs.

## Verification

- `npx eslint src/lib/tick-pipeline.ts`
  - passed with existing unrelated warnings only
- `npx tsx --test tests/score-worker-scorable-loader-contract.test.ts`
  - 1 pass, 0 fail
- `npx tsx --test --test-name-pattern "score RPC" tests/core-rules.test.ts`
  - 2 pass, 0 fail
- `npm run build`
  - passed

## Deferred

- This does not mute watchdog alerts.
- If `score_worker` still fails after deploy, next likely root fixes are:
  - dedicated DB-side claim SQL with an inspected EXPLAIN plan
  - source/listing-type-specific partial indexes for the pid claim
  - further split of primary A worker's non-Daangn scoring duties
