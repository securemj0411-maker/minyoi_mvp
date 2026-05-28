# Wave 911 — Daangn C Category Target Worker

Date: 2026-05-28

## Decision

Add a third Vercel worker role, `daangn_c`, for a category-targeted Daangn ingest experiment.

The existing A/B workers keep broad region firehose coverage. Worker C does not run the broad firehose. It runs `categoryTargetOnly` mode: region x target Daangn category URLs only, with adaptive region/category pair scoring from recent A/B/C collect logs.

## Why

The goal is not short-term sample filling. The long-term goal is to increase Daangn inflow while reducing unrelated household/general-noise fetches and measuring ready conversion per request.

Category-only C gives a clean experiment:

- A/B remain stable broad discovery workers.
- C measures whether target category URLs produce higher catalog-hint and ready conversion.
- If C beats firehose by 1.5x+ ready/request, expand category-heavy routing to A/B/C.

## Initial Runtime Shape

- Route: `/api/cron/daangn-worker-c`
- Project role: `CRON_PROJECT_ROLE=daangn_c`
- Middleware: `daangn_c` project serves only `/api/cron/daangn-worker-c`; all frontend/non-C cron routes are skipped/404.
- Schedule: every five minutes at `4,9,14,...,59`.
- Default target:
  - `DAANGN_INGEST_C_MAX_COMBOS=240`
  - `DAANGN_INGEST_C_CATEGORY_TARGET_REGIONS=30`
  - target categories: digital, hobby/game, sports/leisure, women clothing, beauty, men fashion, women goods, home appliance

## Deployment Notes

- Created Vercel project: `minyoi-mvp-daangn-c`
- Set `CRON_PROJECT_ROLE=daangn_c`
- Copied production runtime env from local `.env.local`; Vercel sensitive env pull returns blank values, so do not use pulled sensitive values as a source of truth.
- Disabled SSO deployment protection for the C worker project. Frontend/non-C routes are still blocked by middleware.
- Fixed project framework from `Other` to `nextjs`; otherwise the deployment built but served Vercel 404 for API routes.

## First Manual Run

Manual force run on production succeeded:

- route: `/api/cron/daangn-worker-c?force=1`
- status: healthy
- combos: 240
- executed: 240
- failed/blocked: 0/0
- articles: 17,060
- catalog-hint articles: 2,191
- classify candidates: 700
- raw upserted: 1
- skipped existing: 1,016
- total: 69.1s

Interpretation: category targeting pulls a very large relevant candidate surface with no block signal. First run mostly overlapped existing A/B firehose data, so the key metric to watch is 12-24h incremental ready/candidate conversion, not first-run raw upsert count.

## Deferred

- Do not move A/B to category-heavy yet.
- Do not remove broad firehose. It is still useful for unexpected new SKU/category discovery.
- Decide expansion only after comparing `ready per request`, `catalogHintArticles per combo`, blocked rate, and user-visible mismatch rate.

## 2026-05-28 22:04 KST Follow-up — A/B/C health and B split gap

After the first automatic C runs, A/B/C collection was rechecked from `mvp_collect_runs`.

Observed:

- A `/api/cron/daangn-worker` was healthy.
- B lane `/api/cron/daangn-worker-b` was healthy as a lane, but the latest host was still the primary A project. That means the B lane was being executed by A, not by the B Vercel project.
- C `/api/cron/daangn-worker-c` was healthy and was executed by the C project host.
- `score-worker-b` had no collect-run rows yet.

Root cause:

- The B Vercel project only had `CRON_PROJECT_ROLE` configured; it was missing `CRON_SECRET` and Supabase runtime envs, so its cron routes could not authenticate or write logs.
- The B route also lacked a route-level `CRON_PROJECT_ROLE=daangn_b` guard, so primary A could still execute `/api/cron/daangn-worker-b`.

Decision:

- Add a route-level B-only guard to `/api/cron/daangn-worker-b`, mirroring the C worker behavior.
- Configure the B project with the minimal cron/runtime envs and redeploy A/B so:
  - A executes only A collection.
  - B executes B collection and `score-worker-b`.
  - C executes only category-target collection.

Deferred:

- Do not add D/E workers yet. First verify that true A/B/C split improves `ready/hour` and that score-worker-b drains Daangn dirty rows without timeout pressure.

## 2026-05-28 22:18 KST Follow-up — score-worker read timeout reduction

Observation after A/B redeploy:

- `score-worker-b` successfully ran on the B project and processed Daangn shard `1/2`.
- Primary `score-worker` still had one transient Supabase statement timeout while reading `mvp_raw_listings`.

Decision:

- Push the scorable `normal` listing predicate into the PostgREST read:
  - before: `detail_status=done`, `sku_id not null`, `listing_state=active`, then JS filtered `listing_type`.
  - after: add `or=(listing_type.eq.normal,listing_type_override.eq.normal)` at the DB filter.
- This matches the existing `isScorableRawCandidate` logic and reduces raw rows sorted/read by score workers.

Deferred:

- Do not raise `PIPELINE_TICK_SCORE_LIMIT` yet. First watch the post-filter duration and failure rate because primary score-worker still performs cleanup while B score-worker is intentionally cleanup-free.

## 2026-05-28 22:26 KST Verification

Deployment:

- Primary A redeployed to `minyoi-mvp.vercel.app`.
- B worker redeployed to `minyoi-mvp-atff.vercel.app`.
- B project production env now includes the cron/Supabase runtime keys plus B shard settings.

Verified:

- Primary A `/api/cron/daangn-worker-b?force=1` returns `project_role_disabled`.
- B `/api/cron/daangn-worker-b` automatic run succeeded from B host:
  - started `2026-05-28T13:26:27Z`
  - combos `366`
  - failed/blocked `0/0`
  - catalog-hint/upsert candidates `1,176`
- B `/api/cron/score-worker-b` automatic runs succeeded from B host:
  - latest observed scored `55`, pool upserted `1`, timed out `false`
  - `score_lane_b_worker=1`
  - `score_source_filter_daangn=1`
  - `score_cleanup_enabled=0`
- A `/api/cron/score-worker` post-filter run succeeded:
  - scored `93`, pool upserted `5`, timed out `false`
  - `score_cleanup_enabled=1`
- C `/api/cron/daangn-worker-c` remains healthy. A 75s run naturally caused the next 5-minute C tick to be skipped by cooldown; this is expected under the current 5-minute guard.

Current interpretation:

- A/B/C collection split is now real: A, B, and C are each writing from their own project host.
- Score bottleneck is partly split: B drains Daangn shard `1/2` quickly; A still handles cleanup + other sources + Daangn shard `0/2`.
- Do not add another worker yet. Watch 12-24h `ready/hour`, `score-worker` failure rate, and C category-target yield before deciding whether C should stay category-only or become another sharded firehose lane.

## 2026-05-28 22:30 KST Follow-up — Daangn cron cooldown

Observation:

- C had a high-yield run around `75s`.
- Because the Daangn worker cooldown was exactly `5m` from start time, a long run starting tens of seconds after the scheduled minute can cause the next 5-minute cron tick to skip even though the previous run already finished.

Decision:

- Lower Daangn worker cooldown defaults from `5m` to `4m` for:
  - `daangn_worker`
  - `daangn_worker_b`
  - `daangn_worker_c`

Why safe:

- Overlap protection is still handled by the active worker lease.
- The shorter cooldown only prevents losing a scheduled tick due to Vercel cron start jitter.
