# 2026-05-29 — Wave 931: Daangn detail backfill batch invalidation enqueue

## Context

After Wave 930 fixed the missing-manner candidate SELECT timeout, Daangn detail workers started succeeding again. The next visible inefficiency was post-detail market invalidation enqueue:

- A/B/C detail workers can patch up to about 300 Daangn rows per 5-minute round.
- Each patched row's comparable key may need market stats recomputation.
- Existing Daangn detail backfill called `enqueue_mvp_market_key_invalidation` once per unique key, producing dozens of sequential REST RPC calls per worker run.

## Change

Added production function and migration:

```text
supabase/migrations/20260529195500_wave931_batch_market_key_invalidation.sql
```

New RPC:

```sql
public.enqueue_mvp_market_key_invalidations(p_events jsonb) returns integer
```

It preserves the existing single-key semantics:

- trims/ignores blank comparable keys,
- groups duplicate keys inside the input batch,
- inserts `pending` rows,
- on conflict increments `event_count`,
- bumps priority using `greatest(existing.priority, excluded.priority)`,
- reopens `done`/`failed` rows to `pending`,
- keeps service-role-only execution.

Updated:

```text
src/lib/daangn-detail-backfill.ts
```

Daangn detail backfill now uses the batch RPC first and falls back to the old per-key RPC if the batch RPC fails.

## Production Apply / Verification

Applied the function directly to production before code deploy to avoid a code-before-schema race.

Verification:

```sql
select public.enqueue_mvp_market_key_invalidations('[]'::jsonb);
-- 0
```

Local verification:

```text
npm run build
=> passed
```

## Expected Effect

- One Daangn detail worker run can replace roughly tens of post-processing RPC calls with one RPC.
- This should reduce worker tail latency and REST failure surface after the actual detail fetch loop.
- It does not change pool gates, source acquisition, score math, or market recomputation semantics.

## Deferred

- Apply the same batch RPC to Joongna and Daangn price sweep enqueue paths if their enqueue volume becomes visible in cron timings.
- If detail fetch itself remains the dominant cost, consider cautious per-host delay tuning only after observing 403/429/block signals.
