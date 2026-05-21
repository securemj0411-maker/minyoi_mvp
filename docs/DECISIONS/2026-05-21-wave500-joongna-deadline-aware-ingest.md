# Wave 500 — Joongna Deadline-Aware Ingest

Date: 2026-05-21 KST

## Context

After Joongna active ingest was enabled, recent cron logs showed successful runs taking roughly 87-100 seconds and multiple runs being auto-marked stale after 3 minutes. The issue is not that Joongna permanently steals Bunjang ready capacity. The larger ready bottleneck is market/stat recomputation backlog, while Joongna ingest itself was too all-or-nothing near the Vercel route ceiling.

## Decision

Make Joongna ingest deadline-aware:

- `joongna-worker` now passes an explicit worker budget, default 75 seconds.
- `runJoongnaIngest` stops search/detail loops before the deadline safety window instead of trying to fill all 80 details.
- Partial successful runs still write raw rows, parsed rows, observations, seller facts, and market invalidations.
- The run result and collect-run stage stats include `budgetStopped` for operator visibility.

## Why This Way

This improves ready throughput without increasing external request volume or taking capacity from Bunjang. A shorter successful partial run is better than an 80-detail run that times out and gets marked stale with no usable output.

## Deferred

- No cron frequency increase was made here.
- Market-worker cadence can be revisited after the new 500-claim invalidation run has at least one or two deployed cycles.
- If Joongna remains consistently under budget, `JOONGNA_WORKER_BUDGET_MS` or ingest detail volume can be tuned later.
