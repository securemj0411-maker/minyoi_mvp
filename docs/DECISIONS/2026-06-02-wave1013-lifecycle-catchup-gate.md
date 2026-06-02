# Wave 1013 — Lifecycle self catch-up gate

Date: 2026-06-02

## Context

After Wave 1012 deployed, production lifecycle runs confirmed the bulk release path:

- `/api/cron/lifecycle-worker`: `claimed=800`, `enriched=0`, `timedOut=true`, `lifecycle_budget_bulk_skipped=800`
- `/api/cron/lifecycle-worker-b`: `claimed=210`, `enriched=0`, `timedOut=true`, `lifecycle_budget_bulk_skipped=210`
- `/api/cron/lifecycle-worker-c`: `claimed=183`, `enriched=0`, `timedOut=true`, `lifecycle_budget_bulk_skipped=183`

This proved the row-by-row skipped-budget write storm was fixed, but the useful lifecycle work was still starved.

Full `stage_stats` showed `stageDurationsMs.lifecycle` around 115s while no detail fetch happened. The time was being spent before row processing, inside the source-health / daangn catch-up / claim path.

## Finding

`lifecycleStage()` still ran `wave978_backfill_daangn_lifecycle_chunk` before every default lifecycle claim.

That catch-up was added as a permanent safety path when old Daangn active rows were missing from lifecycle tracking. However:

- Daangn ingest already has its own catch-up RPC path after raw/parsed writes.
- Running catch-up inside lifecycle competes with lifecycle's primary job: verifying active rows and detecting sold/deleted/reserved state.
- The production symptom is exactly starvation: claim rows, enrich zero, timeout.

## Change

- Lifecycle self catch-up is now opt-in via `LIFECYCLE_DAANGN_CATCHUP_CHUNK`.
- Default is `0`, so lifecycle workers do not run Daangn catch-up unless explicitly enabled.
- Daangn ingest catch-up remains unchanged.
- Added pre-claim timings to lifecycle `stage_stats.timingsMs`:
  - `lifecycle_source_health_ms`
  - `lifecycle_daangn_catchup_ms`
  - `lifecycle_daangn_catchup_inserted`
  - `lifecycle_daangn_catchup_failed`
  - `lifecycle_budget_before_claim`
  - `lifecycle_claim_ms`

## Why This Is Not A Kludge

- It does not silence alerts.
- It does not remove lifecycle verification.
- It keeps the old catch-up ability available behind an explicit env flag.
- It preserves the ingest-side catch-up path, which is closer to the source of new Daangn writes.
- It adds instrumentation so the next decision is based on production timing data instead of guessing.

## Deferred

- If `lifecycle_claim_ms` is still high after this deploy, the next fix should be DB-side:
  - source-aware lifecycle lane for main worker;
  - `request_path, started_at` index for `mvp_collect_runs` diagnostics;
  - source/shard-aware partial indexes or an adjusted claim RPC for `mvp_lifecycle_checks`.
- Any new production schema/index should be reviewed before applying because it affects hot tables.

