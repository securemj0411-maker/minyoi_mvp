# 2026-05-28 Wave 910 — Daangn score-worker B shard

## Context
- Daangn A/B ingestion is working, but ready conversion is gated by `score-worker`.
- User asked whether the B Vercel worker can also take part of scoring instead of only fetching.

## Decision
- Add `/api/cron/score-worker-b` as a B-project-only cron route.
- B score worker processes only Daangn rows and only shard `1/2` by `pid % shardCount`.
- Primary `/api/cron/score-worker` can process Daangn shard `0/2` when `DAANGN_INGEST_REGION_SHARD_COUNT=2` and `DAANGN_INGEST_REGION_SHARD_INDEX=0` are set, while still processing non-Daangn rows normally.
- B score worker disables global score cleanup/residue passes. This avoids doubling expensive DB cleanup work while still converting B's Daangn dirty rows to ready.

## Implementation Notes
- `scoreStage(deadlineMs, options)` now accepts source/shard/cleanup options.
- `loadScorableRows` applies the source filter and Daangn shard filter before scoring.
- `cron-guard` recognizes `score_worker_b`.
- B-only middleware allows `/api/cron/score-worker-b` alongside `/api/cron/daangn-worker-b`; other routes stay blocked on the B project.
- `vercel.json` schedules `/api/cron/score-worker-b` every minute. On the primary project the route returns a cheap `project_role_disabled` skip.

## Verification
- `npx eslint src/lib/tick-pipeline.ts src/lib/cron-guard.ts src/middleware.ts src/app/api/cron/score-worker/route.ts src/app/api/cron/score-worker-b/route.ts`
  - Passed with existing warnings in `tick-pipeline.ts`.
- `npm run build`
  - Passed.
- `npx tsx --test tests/daangn-ingest.test.ts tests/wave249-pool-builder-clamp-fix.test.ts`
  - `daangn-ingest.test.ts` passed.
  - Existing dirty-worktree test failure remains in `tests/wave249-pool-builder-clamp-fix.test.ts`: expected `2000`, actual `7000` for Daangn source-aware cost assertion. This is separate from the score worker split.

## Follow-Up
- After deploy, watch `mvp_collect_runs` for `/api/cron/score-worker-b`.
- Expected healthy signals:
  - `request_path=/api/cron/score-worker-b`
  - `stage_stats.stages.score.timingsMs.score_lane_b_worker=1`
  - `score_source_filter_daangn=1`
  - `score_daangn_shard_count=2`
  - `score_daangn_shard_index=1`
