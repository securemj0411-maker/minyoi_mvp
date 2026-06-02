# Wave 1012 — Lifecycle budget bulk release and Supabase cost audit

Date: 2026-06-02

## Context

- Supabase warned that the project has inefficient / costly DB usage.
- After Wave 1011 fixed Daangn source health, lifecycle workers still showed heavy runtime and many internal `timedOut=true` runs.
- Latest production samples after Daangn source health recovery:
  - `/api/cron/lifecycle-worker`: often `claimed=800`, `enriched=0`, `timedOut=true`, duration around 98-119s.
  - `/api/cron/lifecycle-worker-b`: sample `claimed=543`, `enriched=0`, `timedOut=true`, duration around 78s.
  - `/api/cron/lifecycle-worker-c`: sometimes healthy (`claimed=153`, `enriched=138`), but also had timeout samples.
- A simple exact REST count against `mvp_lifecycle_checks` also returned 500, confirming the table/query surface is expensive enough that `count=exact` should be avoided in hot paths.

## Finding

`lifecycleStage` claimed a batch first, then checked budget row-by-row inside each processing wave.

If the claim/backfill path already consumed the lifecycle budget, the worker still iterated over the claimed rows and called `patchLifecycle(... skipped_budget ...)` per row.

Worst case:

- Claim 800 rows.
- Enrich 0 rows because the budget is already gone.
- Perform up to 800 single-row PATCH calls just to unlock/reschedule rows.

This explains the pattern: successful collect run, zero useful enrichment, high duration, and lots of Supabase write pressure.

## Change

- Added `patchLifecycleRowsByIds()` to release/reschedule lifecycle rows in chunks through existing `patchRowsByIds`.
- Changed lifecycle budget guard:
  - check budget at wave boundary before scheduling another 10-row fetch wave.
  - if budget is exhausted, bulk patch all remaining claimed rows as `skipped_budget` and break.
  - record `lifecycle_budget_bulk_skipped` in `stage_stats.timingsMs`.

## Why This Is Not A Kludge

- It does not hide alerts and does not reduce source verification correctness.
- It preserves the existing `skipped_budget` semantics and retry cadence.
- It only changes the release path from hundreds of single-row PATCH calls to chunked PATCH calls.
- With `REST_WRITE_CHUNK_SIZE=25`, an 800-row budget miss becomes about 32 PATCH calls instead of 800.

## Deferred

- The deeper DB-side issue remains: lifecycle claim/query/index strategy needs a separate pass.
- Candidate next steps:
  - make base lifecycle lane source-aware instead of `sourceFilter=null` with a huge mixed-source batch;
  - consider source-specific/shard-specific partial indexes for Daangn lifecycle claims;
  - add lower per-lane batch caps for lanes that repeatedly time out;
  - avoid `count=exact` on `mvp_lifecycle_checks` in dashboards or diagnostics.

## Verification

- `npx tsx --test tests/cron-guard.test.ts tests/lifecycle-state.test.ts`
  - 16 pass, 0 fail
- `npm run build`
  - Passed
  - Existing landing showcase sold-preview query again hit Supabase `57014` during static revalidation, then fell back successfully.
  - This query is a separate Supabase-cost follow-up candidate: `/mvp_raw_listings` sold preview ordered by `sold_detected_at`.
