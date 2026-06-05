# Wave 1046 — cron-watchdog guard skip alert gap

## Trigger

Daangn ingest was stuck behind `source_health_unhealthy` guard skips for a long period, but Telegram did not alert. The issue was found manually from operator checks instead.

## Root Cause

- `cron-watchdog` only watched `mvp_collect_runs.started_at`.
- The Daangn incident happened before `startCollectRun()`: `cron-guard` returned `skipped_unhealthy`, so no `mvp_collect_runs` row was created.
- Daangn ingest workers were also missing from `WATCHDOG_TARGETS`.
- Existing path prefix matching could also hide a base worker gap because `/api/cron/daangn-worker*` matches `/api/cron/daangn-worker-b` and `/api/cron/daangn-worker-c`.

## Decision

Add a second watchdog signal from `mvp_cron_executions` so cron calls that are invoked but blocked by `source_health_unhealthy` become Telegram incidents.

## Implemented

- Added watchdog targets for:
  - `lifecycle-worker-b/c`
  - `score-worker/a/b/c`
  - `joongna-worker`
  - `daangn-worker/a/b/c`
  - `daangn-detail-worker`
  - `daangn-price-sweep-worker`
- Added `mvp_cron_executions` guard-skip lookup by worker mode.
- Alert condition:
  - latest execution for that mode is `skipped_unhealthy` or `skip_reason=source_health_unhealthy`
  - and the skip has persisted beyond the target threshold, or the source-health row age exceeds the threshold.
- Guard-skip alerts use a separate cooldown key: `watchdog_alert_<worker>_guard_skip`.
- Generic stale collect alert is suppressed when the guard-skip alert already explains the same worker.
- Replaced unsafe request path prefix matching with exact-or-query matching:
  - `request_path = /api/cron/X`
  - or `request_path like /api/cron/X?*`

## Verification

- `npx tsx --test tests/cron-watchdog.test.ts tests/cron-guard.test.ts`
  - 13 pass, 0 fail
- `npm run build`
  - passed
- Live read-only Supabase check:
  - recent `mvp_cron_executions` rows exist for `daangn_worker`, `daangn_worker_b`, `daangn_worker_c`
  - current statuses are `running`/`success`, not guard skipped.
- Live read-only `mvp_collect_runs` check:
  - newly watched target paths all had recent rows.

## Deferred

- External uptime monitoring for `/api/cron/tick` itself is still separate. If `tick` stops entirely, in-app watchdog cannot execute.
- B/C detail and price-sweep shard-specific guard modes can be split into separate targets later if we want per-shard stale alerts, but current collect path confirms the shared endpoint is active.
