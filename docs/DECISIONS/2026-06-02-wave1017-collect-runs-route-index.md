# Wave 1017 — Collect Runs Route Index

Date: 2026-06-02

## Finding

While verifying the landing-showcases cron after Wave 1016, this route-scoped
query timed out:

- table: `mvp_collect_runs`
- filter: `request_path = /api/cron/landing-showcases`
- filter: `started_at >= last 24h`
- order: `started_at desc`
- result: `57014 canceling statement due to statement timeout`

Existing indexes covered `started_at` and `status + started_at`, but not the
common watchdog/operator pattern of `request_path + started_at`.

## Decision

Add a concurrent index:

```sql
create index concurrently if not exists mvp_collect_runs_request_path_started_idx
  on public.mvp_collect_runs (request_path, started_at desc);
```

This is read-path optimization only. It does not change data or cron behavior.

## Production DB Action

`supabase db push` remains unsafe because remote migration history is not aligned
with the local migration directory, so the single additive SQL was applied
directly.

Production application:

- duration: `54.4s`
- index exists: `public.mvp_collect_runs_request_path_started_idx`

## Verification

The same landing-showcases collect-run lookup after index creation:

- status `200`
- duration `240ms`
- body `[]`

Interpretation: route-scoped cron history reads are no longer scanning excessive
history. This should reduce watchdog/operator-report DB cost.

## Deferred

- Do not add more collect-run indexes until an actual query pattern times out or
  appears in pg_stat hotpaths.
- Migration history reconciliation remains separate; do not use bulk `db push`
  until that is repaired deliberately.
