# 2026-06-02 wave1008 - Daangn ready/lifecycle/velocity health check

## Question

Daangn ready count used to reach about 9,000/day but is currently around 5,000. Need to determine whether this is an intake problem or evidence that lifecycle workers are finally cleaning stale/sold rows.

## Findings

Checked at `2026-06-02T06:50Z` (`2026-06-02 15:50 KST`).

### Pool

- Total ready sample: `6,315`
- Ready by source:
  - `daangn`: `5,269`
  - `bunjang`: `908`
  - `joongna`: `138`
- Daangn ready raw states:
  - `active`: `5,111`
  - `sold_confirmed`: `97`
  - `disappeared`: `61`
- Recent Daangn ready rows had `last_seen_at` up to `2026-06-02T06:50:00Z`.

### Daangn raw intake

Recent `mvp_raw_listings` sample ordered by `last_seen_at desc`:

- Latest `last_seen_at`: `2026-06-02T06:48:46Z`
- Latest `first_seen_at`: `2026-06-02T06:49:08Z`
- Sample rows are fresh, so intake is not stopped.
- Recent 1,000 sample states:
  - `active`: `639`
  - `sold_confirmed`: `322`
  - `disappeared`: `39`
- Recent 1,000 detail statuses:
  - `pending`: `709`
  - `done`: `291`

### Daangn invalidations

Daangn invalidated rows in the last 24h sample:

- `24h`: `402`
- `6h`: `234`
- `1h`: `5`

Top invalidation reasons:

- `sku_median_unavailable`: `195`
- `negative_resell_gap`: `110`
- `lifecycle_sold_sale_status_inactive`: `29`
- `lifecycle_state_missing_suspect`: `15`
- `blocked_deep_discount_review`: `12`
- `pool_eligible_false_residue`: `9`

This supports the interpretation that ready count reduction is partly lifecycle/pool cleanup, not simply acquisition failure.

### Lifecycle

Recent `last_checked_at desc` sample:

- Latest checked row: `2026-06-02T06:43:36Z`
- 1h checked sample count: `608`
- last 1,000 checked results:
  - `active`: `803`
  - `error`: `97`
  - `sold`: `94`
  - `missing`: `6`
- last 1,000 lifecycle statuses:
  - `active`: `803`
  - `missing_suspect`: `97`
  - `sold_confirmed`: `94`
  - `disappeared`: `6`
- There is backlog: due sample returned 1,000 rows, oldest due `2026-05-30T05:36Z`.

Recent collect runs:

- `/api/cron/lifecycle-worker`: latest 20 in 24h sample, `0` failed.
- `/api/cron/lifecycle-worker-b`: latest 20 in 24h sample, `0` failed.
- `/api/cron/lifecycle-worker-c`: latest 20 in 24h sample, `0` failed.

Lifecycle is running and detecting terminal states, but backlog still exists.

### Daangn intake workers

Recent collect runs:

- `/api/cron/daangn-worker`: latest 20 in 24h sample, `0` failed.
  - Latest runs collected `46,429`, `41,487`, `57,963`; upserted `356`, `310`, `480`.
- `/api/cron/daangn-worker-b`: latest 20 in 24h sample, `0` failed.
  - Latest runs collected `43,294`, `40,710`, `37,629`; upserted `0`, `457`, `226`.
- `/api/cron/daangn-worker-c`: latest 20 in 24h sample, `0` failed.
  - Latest runs collected `33,479`, `34,982`, `36,898`; upserted `68`, `631`, `0`.

Daangn intake is operating.

### Price sweep / velocity

Daangn price sweep:

- `/api/cron/daangn-price-sweep-worker`: latest 20 in 24h sample, `0` failed.
- Latest runs include successful sample fetch/upsert work.

Velocity table:

- `mvp_market_velocity_daily` rows for `2026-06-02`: `4,905`
- Latest `computed_at`: `2026-06-02T06:19:42Z`
- high/medium rows: `306`
- Categories present: `shoe`, `clothing`, `tablet`, `smartphone`, `laptop`, `smartwatch`, `game_console`, `bag`, `sport_golf`, `earphone`, and smaller categories.

Velocity materialization is current enough as of this check.

## Observability Issues Found

These are not direct intake failures but should be fixed:

- `mvp_raw_listings` exact count by `source + last_seen_at` timed out via PostgREST.
- `mvp_raw_listings` sold query ordered by `sold_detected_at` timed out.
- Full REST scan of `mvp_lifecycle_checks source=daangn` timed out after offsets around 16k.
- Exact `mvp_collect_runs` query for `/api/cron/sync-market-velocity` timed out, though velocity table itself is fresh.
- `mvp_source_health` has stale Daangn row from `2026-05-25`; source-health observability for Daangn is not reliable right now.

## Decision

Interpret current Daangn ready count around 5k as mostly healthier lifecycle cleanup plus stricter downstream filtering, not a stopped intake.

However, this is not fully “done” operationally:

- lifecycle backlog still exists;
- Daangn source health reporting is stale;
- observability queries need indexes/RPC/cached summaries so operators can verify health without PostgREST statement timeouts.

## Next Follow-Up

Recommended next wave:

1. Add or verify indexes/RPC for Daangn health checks:
   - `mvp_lifecycle_checks(source, last_checked_at desc)`
   - `mvp_lifecycle_checks(source, next_check_at)` for due backlog
   - `mvp_raw_listings(source, sold_detected_at desc)` partial for sold rows
   - `mvp_collect_runs(request_path, started_at desc)` or a health summary RPC
2. Repair Daangn `mvp_source_health` updates so Telegram/source health reflects Daangn specifically, not just generic/bunjang labels.
3. Add a compact operator health endpoint that returns Daangn ready/intake/lifecycle/velocity in one cheap response.
