# 2026-05-30 — Wave 943: Ops alert / deep-crawl runtime guard

## Trigger

Telegram operations alerts showed:

- `score_worker` warning around 8% failures.
- `deep_crawl_failure_rate_elevated`.
- `daangn_detail_worker` warning around 5% failures.

The alert source said `bunjang` because the source-health row is still keyed as `bunjang`, but the health baseline also includes internal worker breakdowns such as score, market, and Daangn detail workers.

## Findings

- Latest health recovered at `2026-05-30 00:22 KST` after the recovery hysteresis window.
- `score_worker` failures were mostly Supabase statement timeouts plus one pre-existing negative `condition_score` write. The negative score path was already fixed by Wave 941/942-era parser clamping.
- `daangn_detail_worker` warning was one stale C-shard run before the paced overlap detail-worker deploy. Post-deploy C detail verification completed around 64s with `selected/fetched/patched = 100/100/98`.
- `deep-crawl` successes were running close to the 90s route ceiling. Recent successful runs showed `build_detail_decisions` dominating runtime at roughly 28-74s.
- Source health loaded only 200 recent collect runs. With A/B/C workers now firing every minute, that can truncate the intended 120-minute health window.

## Decision

### 1. Cap deep-crawl title triage

Deep-crawl is a coverage sweep, not a same-run scoring worker. Keep raw collection/upsert behavior, but cap CPU-heavy title triage to 120 rows.

Selection is hybrid:

- 60% highest-signal rows by favorites/price.
- 40% rotating tail rows, so deep pages do not permanently starve lower-favorite listings.

Deferred rows are not persisted as `title_triage_skip`, so later fresh/detail cycles can still pick them up naturally.

### 2. Expand source-health run sample

Increase source-health recent run fetch from 200 to 600, with env override:

- `PIPELINE_SOURCE_HEALTH_RUN_LIMIT`

This better matches the current A/B/C cron volume without schema changes.

### 3. Avoid degraded status from a single worker sample

Require at least 2 runs before `sourceWorkerFailureStatus()` can propose degraded status for a worker. A single failed low-cadence run can still appear as an operational warning, but should not by itself flip source status.

## Verification

- `npx eslint src/lib/tick-pipeline.ts src/lib/pipeline-config.ts tests/query-cadence-balance.test.ts`
  - pass with existing unrelated warnings:
    - `trimmedSellerMarket` unused
    - `MARKET_INVALIDATION_FAST_LANE_PREFIXES` unused
- `npx tsx --test tests/query-cadence-balance.test.ts`
  - 6 pass, 0 fail
- `npm run build`
  - passed
- Production manual run after the first cap (`200`) succeeded instead of timing out:
  - `runId=6650f28e-8146-42f5-814f-9d3c685a6f84`
  - duration: `60.5s`
  - `detail_refresh_items=369`
  - `detail_decision_items=200`
  - `build_detail_decisions=46.7s`
- Based on that still-high CPU cost, cap was tightened to `120` with rotating-tail selection.
- Production manual run after the final cap (`120`) on deployment `f493308e`:
  - `runId=ac4860a2-1150-4919-bef0-9270ae98fe31`
  - duration: `30.0s`
  - `detail_refresh_items=169`
  - `detail_decision_items=120`
  - `deep_detail_triage_deferred_rows=49`
  - `deep_detail_triage_priority_rows=72`
  - `deep_detail_triage_rotated_rows=48`
  - `build_detail_decisions=20.8s`

## Watch After Deploy

- Deep-crawl duration should move away from the 90s ceiling.
- `stage_stats.stages.search.timingsMs.build_detail_decisions` should drop on large deep-crawl pages.
- Source-health worker breakdown should include a fuller 120-minute sample.
- Continue watching A `score_worker` statement timeout. If it persists after the parser clamp and cleanup indexes, the next fix should be a DB-side scorable-claim RPC or a more specific partial index for `source + listing_type + score_dirty + last_seen_at`.
