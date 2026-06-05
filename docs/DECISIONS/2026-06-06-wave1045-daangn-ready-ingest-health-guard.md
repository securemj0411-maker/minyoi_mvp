# Wave 1045 — Daangn ready shrink root cause: stale source-health permanent skip

## Context

User reported source-ready counts:

| source | ready |
|---|---:|
| bunjang | 941 |
| joongna | 524 |
| daangn | 2,841 |

Daangn had previously been expected to sit higher, so we audited whether this was cadence, lifecycle cleanup, or a broken worker.

## Findings

DB/runtime audit at 2026-06-06 KST:

- `mvp_candidate_pool.status='ready'` total: 4,315
  - daangn: 2,848
  - bunjang: 941
  - joongna: 526
- Daangn raw was not dead:
  - `first_seen_at >= 1h`: 76
  - `first_seen_at >= 24h`: 1,224
  - `last_seen_at >= 24h`: 14,155
  - active + sku + detail done + eligible in last 24h: 2,254
- Daangn ready rows had freshness debt:
  - ready rows with `last_verified_at` older than 6h: 2,367 / 2,848
- Recent Daangn invalidations in 24h: 2,993
  - `lifecycle_missing_suspect_persist`: 796
  - `sku_median_unavailable`: 695
  - `negative_resell_gap`: 515
  - `lifecycle_sold_sale_status_inactive`: 430
  - `velocity_missing`: 236
- `daangn-price-sweep-worker` was still running every 5 minutes and writing some rows.
- Main ingest `daangn-worker / b / c` had no `mvp_collect_runs` after 2026-06-04 02:53 KST.
- Vercel Cron was registered and invoking the paths with HTTP 200.
- `mvp_cron_executions` showed the real block:
  - `mode=daangn_worker*`
  - `status=skipped_unhealthy`
  - `skip_reason=source_health_unhealthy`
  - stale health row from 2026-06-04 02:53 KST
  - reason `blocked:http_403_access_denied`

## Root Cause

`src/lib/cron-guard.ts` only allowed stale unhealthy source-health rows to expire for `market_worker`.

That meant one transient Daangn 403 marked source health unhealthy, and then the worker that could refresh that health was permanently blocked. Price sweep kept running, but broad Daangn ingest did not.

## Change

Changed `shouldSkipForSourceHealth()` so every source-health guarded worker can probe again after `CRON_GUARD_SOURCE_HEALTH_STALE_MS` (default 10 minutes).

This preserves the recent-unhealthy block but prevents permanent deadlock.

Added regression coverage:

- `cron guard lets daangn ingest probe when source health is stale`

## Verification

```bash
npx tsx --test tests/cron-guard.test.ts
```

Result: 10 pass, 0 fail.

```bash
npm run build
```

Result: passed.

## Post-deploy Verification

After deploying commit `cacfc656`:

- Manual `vercel crons run /api/cron/daangn-worker` no longer skipped on stale unhealthy source health.
- `mvp_collect_runs` recorded a real `daangn_worker` run:
  - status: `succeeded`
  - collected: 47,413
  - raw upserted: 500
  - duration: 147,517ms
- `mvp_source_health` latest Daangn row recovered:
  - status: `healthy`
  - reason: `ok`
  - checked_at: 2026-06-05T22:19:14Z
- Automatic schedule also recovered:
  - `/api/cron/daangn-worker` started a new collect run at 2026-06-05T22:23:13Z
  - status at check time: `running`
- Immediate ready snapshot after the run:
  - daangn: 2,845
  - bunjang: 957
  - joongna: 525

Ready count is not expected to jump instantly; the new raw rows still need detail/score/pool cycles.

## Follow-up

After deploy:

1. Recheck source-ready counts after several score/lifecycle cycles; ready should recover gradually if ingest produces valid, market-supported rows.
2. Consider a source-health probe route/worker so source health can refresh independently without needing the full heavy worker to run.
