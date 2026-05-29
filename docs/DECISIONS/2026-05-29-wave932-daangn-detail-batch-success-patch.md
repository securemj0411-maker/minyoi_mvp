# 2026-05-29 — Wave 932: Daangn detail backfill batch success patch

## Context

Wave 930 fixed Daangn detail candidate SELECT timeouts. Wave 931 reduced market invalidation enqueue from many RPC calls to one batch RPC.

The next inefficiency was successful detail patching:

- Each fetched Daangn detail success updated `mvp_raw_listings` with one REST PATCH.
- A/B/C detail shards can patch roughly 300 rows per 5-minute round.
- This creates unnecessary REST round trips while preserving no additional safety; the actual Daangn page fetch remains sequential and delay-bound.

## Change

Added production function and migration:

```text
supabase/migrations/20260529201000_wave932_batch_daangn_detail_success_patch.sql
```

New RPC:

```sql
public.patch_mvp_daangn_detail_backfill_successes(p_rows jsonb) returns integer
```

It updates only existing Daangn raw rows by pid:

- `daangn_manner_temperature`
- `daangn_review_count`
- `detail_status='done'`
- `detail_enriched_at=now()`
- `detail_error=null`
- `score_dirty=true`
- `updated_at=now()`

Updated:

```text
src/lib/daangn-detail-backfill.ts
```

The worker now:

1. fetches detail pages sequentially with the existing delay,
2. accumulates successful manner-temperature patches,
3. applies successes through the batch RPC once,
4. keeps the old per-row PATCH as fallback if the batch RPC fails.

## Production Apply / Verification

Applied the function directly to production before code deploy to avoid a code-before-schema race.

Verification:

```sql
select public.patch_mvp_daangn_detail_backfill_successes('[]'::jsonb);
-- 0
```

Local verification:

```text
npm run build
=> passed
```

## Expected Effect

- Replace up to ~100 success PATCH calls per Daangn detail shard run with one RPC.
- Reduce Supabase REST round trips and worker tail latency.
- Preserve Daangn fetch cadence and block-risk posture because no fetch concurrency/delay changes were made.

## Deferred

- Batch error/gone patching remains possible, but current error volume is low enough that success batching is the highest-return low-risk change.
- Further speedups should be based on post-deploy timing for `daangn_detail_worker_*` duration and `skippedByBudget`.
