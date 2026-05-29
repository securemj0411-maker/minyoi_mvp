# 2026-05-29 — Wave 942: Daangn ingest/detail root tuning

## Context

After A/B/C Daangn expansion, ready growth improved but two hot paths remained:

- `daangn-worker` row build CPU: classifier/parser can run hundreds of times per ingest run.
- `daangn-detail-worker` B/C tail latency: 100 detail fetches often took 120-150s, close to the next 5-minute tick.

Recent production snapshot before this change:

- Daangn ready: 2,913
- Daangn active SKU rows missing manner temperature: 13,659
- Daangn active SKU rows with manner temperature: 50,369
- Daangn scoreable dirty backlog: 4,700
- 2h detail worker totals:
  - A: avg 59.7s, 1,821 patched
  - B: avg 148.4s, 2,087 patched, 66 skipped by budget
  - C: avg 128.8s, 2,077 patched

## Decision

### 1. Ignore volatile Daangn `viewCount` during ingest preflight equality

`viewCount` changes frequently and is not used for score/pool decisions. Treating it as a meaningful raw-json difference can force otherwise stable rows through expensive SKU classification/parser work.

Changed:

- `sameDaangnRawJson()` no longer compares `viewCount`.
- It still compares `externalId`, `imageCount`, and region identity because those affect listing identity or user-facing risk/context.

Expected effect:

- Fewer unnecessary `classifyListing()` / `parseListingOptions()` calls on repeated firehose rows.
- Lower `timingsMs.rowBuild` and `timingsMs.classifyCandidates` on runs dominated by already-seen listings.

### 2. Add paced overlap for Daangn detail fetches

The detail worker previously fetched sequentially and slept after each row. That made B/C shards spend 120-150s on 100 rows.

Changed:

- Added `DAANGN_DETAIL_WORKER_CONCURRENCY`.
- Default for sharded A/B/C detail worker is now `concurrency=2`.
- Default delay under concurrency is `600ms`.
- Fetch starts are paced by delay, so requests do not burst all at once; only in-flight network wait overlaps.
- Sequential mode is still available by setting `DAANGN_DETAIL_WORKER_CONCURRENCY=1`.

Expected effect:

- Reduce B/C detail worker duration from 120-150s toward roughly 60-80s while keeping external request starts paced.
- Reduce `skippedByBudget` and speed up manner-temperature availability, which directly unblocks Daangn ready promotion.

## Verification

- `npx eslint src/lib/daangn-detail-backfill.ts src/app/api/cron/daangn-detail-worker/route.ts src/lib/daangn-ingest.ts tests/daangn-ingest.test.ts`
  - pass
- `npx tsx --test tests/daangn-ingest.test.ts`
  - 28 pass, 0 fail
- `npm run build`
  - passed

## Watch After Deploy

- `daangn_detail_worker_*`:
  - duration
  - blocked/blockReason
  - skippedByBudget
  - fetchFailed/nullScore
- `daangn-worker`:
  - `timingsMs.rowBuild`
  - `classifyCandidates`
  - `preflightSkipped`
- Daangn ready count and `daangn_manner_temperature_missing` invalidations.

If block signals appear, set `DAANGN_DETAIL_WORKER_CONCURRENCY=1` or raise `DAANGN_DETAIL_WORKER_DELAY_MS`.

## Post-deploy Verification

- A/B Git deployments updated automatically after push.
- C project was deployed from a clean detached worktree at commit `8e5025b4` to avoid uploading unrelated dirty local files.
- Manual C detail run:
  - route: `/api/cron/daangn-detail-worker?manual=wave942`
  - guard: `daangn_detail_worker_c`
  - selected/fetched/patched: `100 / 100 / 98`
  - blocked: `false`
  - skippedByBudget: `0`
  - concurrency: `2`
  - duration: `64.0s`
- Previous C runs before this deploy were around `127-134s`, so paced overlap roughly halved the C shard duration in the first live check.
