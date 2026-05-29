# Wave 933 — Daangn score third shard

Date: 2026-05-29

## Context

Daangn ingestion is no longer the primary bottleneck after the dong-level region expansion and A/B/C workers.

Recent 30 minute production snapshot before this change:

- `/api/cron/daangn-worker`: 6 succeeded, 0 failed, 308,833 collected, 2,793 raw upserted
- `/api/cron/daangn-worker-b`: 6 succeeded, 0 failed, 364,072 collected, 4,009 raw upserted
- `/api/cron/daangn-worker-c`: 6 succeeded, 0 failed, 231,768 collected, 2,027 raw upserted
- Daangn raw upsert rate: about 8,829 rows / 30 min, about 294 rows/min
- `/api/cron/score-worker`: 21 succeeded, 1 failed, 1,105 output upserts
- `/api/cron/score-worker-b`: 21 succeeded, 0 failed, 1,129 output upserts
- Score capacity was still fixed at about 200 dirty rows/min because both workers load 100 rows/run.

This means raw Daangn rows can arrive faster than score/pool promotion can drain them. Ready count can look stagnant even when ingestion is healthy.

## Decision

Add a dedicated C score shard for the Daangn C project:

- New route: `/api/cron/score-worker-c`
- New cron: every minute
- Route runs only when `CRON_PROJECT_ROLE=daangn_c`
- C score shard uses:
  - `sourceFilter: "daangn"`
  - `daangnShardCount: 3`
  - `daangnShardIndex: 2`
  - cleanup disabled

Also change defaults so A/B/C form a 3-way Daangn scoring partition:

- main `/api/cron/score-worker`: Daangn shard default `0/3`
- `/api/cron/score-worker-b`: Daangn shard default `1/3`
- `/api/cron/score-worker-c`: Daangn shard default `2/3`

Auxiliary Daangn projects now skip the generic `/api/cron/score-worker`, so B/C do not waste the shared `score_worker` guard lock. They should use only their dedicated score workers.

## Expected Effect

Daangn scoring capacity should move from about 200 dirty rows/min to about 300 dirty rows/min without increasing external marketplace fetches.

This targets ready promotion directly:

- less raw score_dirty backlog
- less delay between Daangn ingestion and candidate_pool promotion
- fewer generic score lock collisions from B/C deployments

## Verification

`npm run build` passed.

Build warnings only:

- Next.js middleware convention deprecation warning
- metadataBase fallback warning

## Deferred

Not changed in this wave:

- `PIPELINE_TICK_SCORE_LIMIT` remains 100. Increasing row limit is riskier because past 300-row runs timed out.
- Daangn ingest B rowBuild spikes remain a separate optimization target.
- Detail worker latest post-batch performance should be observed after the next production deployment window.
