# Wave 1014 — Source health stale-marker alert filter

Date: 2026-06-02

## Context

Operator Telegram alerts after repeated production deploys:

- `Market: 20% 실패 (2/10)`
- `Housekeeper: 33% 실패 (1/3)`

Recent `mvp_collect_runs` inspection showed the failed rows were not real worker exceptions:

- `/api/cron/market-worker` at `2026-06-02T08:32:29Z`: `stale running run auto-marked after 8m`
- `/api/cron/housekeeper` at `2026-06-02T08:37:28Z`: `stale running run auto-marked after 8m`

Market recovered immediately after:

- `17:42 KST`, `17:52 KST`, `18:02 KST` succeeded.

## Finding

`sourceHealthStage()` counted every `mvp_collect_runs.status = failed` row as a worker failure.

That means a collect-log cleanup row created by `markStaleCollectRuns()` could page as a real Market/Housekeeper failure-rate incident, especially during production deployment churn where a cron invocation starts on an old deployment but does not write its finish log.

## Change

- Added `error_message` to `loadRecentCollectRuns()` selection.
- Added `isStaleCollectRunAutoMarked()`.
- Added `isEffectiveCollectRunFailure()`.
- `failedRuns`, `failedRunRate`, and `workerBreakdown.failed` now exclude `stale running run auto-marked after Nm`.
- The stale markers are still recorded in source health `baseline_json`:
  - `staleMarkedRuns`
  - `staleMarkedRunsByMode`

## Why This Is Not A Kludge

- It does not delete failed rows.
- It does not silence real worker exceptions.
- It keeps stale marker counts visible in diagnostics.
- It only prevents deploy/finalizer cleanup rows from being mixed into source-health worker failure-rate alerts.

## Deferred

- If stale markers continue without later successes, inspect function max duration / collect-run finish logging separately.
- `mvp_collect_runs(request_path, started_at desc)` is still a DB hotpath improvement candidate; broad latest-run queries can time out.

## Production Verification

After deploy `minyoi-is8n32umm-securemj0411-7703s-projects.vercel.app`, the next source-health row confirmed the filter is active:

- `checked_at`: `2026-06-02T09:22:35Z` (`18:22 KST`)
- `status`: `healthy`
- `reason`: `within_operating_bounds`
- `baseline_json.staleMarkedRuns`: `14`
- `baseline_json.staleMarkedRunsByMode.market_worker`: `1`
- `baseline_json.staleMarkedRunsByMode.housekeeper`: `1`
- `workerBreakdown.market_worker.failed`: `0`
- `workerBreakdown.housekeeper.failed`: `0`
- `operationalAlerts`: `[]`
- `notification`: `recovered`

This verifies the Telegram Market/Housekeeper alert was not hidden globally. The stale-marker rows remain visible in diagnostics, while worker failure-rate alerts now count only effective failures.
