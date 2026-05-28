# 2026-05-28 Wave 913 — Daangn ready stagnation diagnosis

## Context

The operator reported that Daangn ready count is stagnant even after A/B/C Daangn workers were introduced.

Current production snapshot checked at `2026-05-28T14:37Z`:

- Daangn candidate pool: `ready=441`, `invalidated=474`.
- Candidate pool rows updated in the last hour: `ready=52`, `invalidated=136`.
- Recent score workers processed many rows but promoted only a small fraction:
  - 120 recent score runs: `scored=8,992`, `poolUpserted=261`, `poolSkipped=8,718`.
- Top score skip reasons:
  - `negative_resell_gap`: 3,713
  - `sku_median_unavailable`: 1,720
  - `daangn_manner_temperature_missing`: 1,246
  - `profit_not_positive_after_costs`: 731
  - `sku_low_volume_below_2d1_or_7d3`: 434
  - `daangn_volume_below_3`: 185
  - `profit_below_pack_band`: 180

## Findings

1. Raw search volume is not the only bottleneck.
   - A/B/C workers are fetching large pages, but many candidates are already-known slugs.
   - Example latest runs:
     - A: `upsertCandidateArticles=4,111`, `rawSkippedExisting=3,941`, `upsertedCount=170`.
     - B: `upsertCandidateArticles=1,822`, `rawSkippedExisting=1,822`, `upsertedCount=0`.
     - C: `upsertCandidateArticles=5,000`, `rawSkippedExisting=4,733`, `upsertedCount=267`.
   - This means the workers are spending a lot of budget re-touching the same visible Daangn search surface.

2. Detail/manner enrichment is too shallow for the amount of discovered inventory.
   - A/B/C latest detail fetch counts are still small per run: A `5`, B `8`, C `6`.
   - The candidate builder hard-blocks active Daangn rows without `daangn_manner_temperature`.
   - Manual manner backfill in Wave 912 proved this is a real lever: ready rose from roughly 412 to 442 while missing-manner invalidations dropped.

3. Production price-sweep is still not using the local safe fix.
   - Recent production `daangn-price-sweep-worker` runs still show `blockedCombos=288`, `rawUpserted=0`.
   - Wave 912 local code changes fixed the sweep shape, but the dirty worktree was not deployed.
   - Until scoped deploy happens, `sku_median_unavailable` and `daangn_volume_below_3` will drain ready candidates.

4. Score conversion is the main ready-count limiter.
   - `negative_resell_gap` is expected: many Daangn rows are not profitable.
   - `sku_median_unavailable` and `daangn_volume_below_3` are fixable by source-specific sample filling.
   - `daangn_manner_temperature_missing` is fixable by detail/manner backfill.
   - `profit_below_pack_band` still appears, but it is not the dominant blocker in this sample.

## Decisions

1. Do not loosen accuracy gates first.
   - Relaxing `sku_median_unavailable` or `daangn_volume_below_3` would raise ready count but lower trust.
   - The better first move is to fill missing Daangn source samples and details.

2. Split Daangn work into three roles instead of making A/B/C all do everything.
   - Discovery workers: keep scanning broad/category surfaces, but optimize by new-slug yield.
   - Detail/manner worker: fetch detail pages for `active + sku_id + detail_status=pending/null` rows.
   - Price-sweep worker: fill source-market samples for ready SKUs with missing/low Daangn sample counts.

3. Adaptive rotation must optimize for new-slug yield, not only fetched article volume.
   - Regions/categories with high `rawSkippedExisting / upsertCandidateArticles` should cool down.
   - Regions/categories that produce fresh `rawUpserted` and later `poolUpserted` should run more often.

4. Production price-sweep fix should be deployed as a scoped change before expecting sample coverage to improve.
   - The local fix is verified, but production logs show the old blocked behavior.

## Next Work

1. Scoped deploy Wave 912 price-sweep and manner traceability changes only.
2. Add a permanent Daangn detail/manner backfill worker or scheduled script.
3. Increase/redistribute detail fetch budget after measuring block rate:
   - keep discovery workers safe;
   - move more detail fetching into the dedicated backfill worker instead of inflating every firehose run.
4. Add per-run/new-yield metrics:
   - `newRawInserted`
   - `existingRetouched`
   - `detailMannerPatched`
   - `poolReadyDelta`
   - `readyPromotedFromMissingMedian`
5. Re-score/recover invalidated rows after sample/detail fills.

## Deferred

- Category-only aggressive Daangn crawling across A/B/C/D is deferred.
  It may increase load and duplicate rate without solving `sku_median_unavailable` and `manner_missing`.
- Lowering ready-quality gates is deferred until after price-sweep/detail backfill are deployed and measured.

## Implementation Update

Added a permanent `daangn-detail-worker`:

- Route: `/api/cron/daangn-detail-worker`
- Default cadence: every 5 minutes
- Default work size: 45 Daangn detail pages/run
- Default safety shape: sequential detail fetch with `700ms` delay and `8s` timeout
- Project role: runs on primary/all/`daangn_detail`; B/C worker projects skip by default

The worker prioritizes:

1. `mvp_candidate_pool.status=invalidated`
   - `invalidated_reason=daangn_manner_temperature_missing`
   - active Daangn raw row
   - `sku_id` present
2. Other active Daangn raw rows with:
   - `sku_id` present
   - `daangn_manner_temperature IS NULL`

On success it patches raw rows:

- `daangn_manner_temperature`
- `daangn_review_count`
- `detail_status=done`
- `detail_enriched_at`
- `score_dirty=true`

On 404/410 it marks the raw listing as `disappeared` and labels invalidated pool rows as `daangn_detail_404_manner_backfill`.

This confirmed the operator's point: the issue is not that Daangn products lack manner temperature; it is that our list/search ingest does not include it and our old detail sample budget was too shallow.

## Immediate Manual Verification

- Dry-run detail backfill:
  - selected: 2
  - fetched: 2
  - would patch: 1
  - would mark gone: 1
  - blocked: false
- Real detail backfill:
  - selected: 20
  - fetched: 20
  - patched: 16
  - marked gone: 4
  - null score: 0
  - parse failed: 0
  - blocked: false

Verification commands:

- `npx eslint src/lib/daangn-detail-backfill.ts src/app/api/cron/daangn-detail-worker/route.ts src/lib/cron-guard.ts`
- `npm run build`

Both passed.

## 2026-05-29 KST Production Review

Checked production collect logs around `2026-05-29 00:04 KST`.

Current Daangn pool:

- `ready=450`
- `invalidated=465`
- `daangn_manner_temperature_missing=89`
- `ready` rows still missing manner temp: 93

Important production findings:

1. `daangn-detail-worker` has not run in production yet.
   - `mvp_collect_runs` has 0 rows for `/api/cron/daangn-detail-worker`.
   - The route exists and builds locally, but it has not been deployed to production.

2. `daangn-price-sweep-worker` is still running the old production shape.
   - Latest runs still show `blockedCombos=144`, `fetchedArticles=0`, `rawUpserted=0`.
   - This confirms the Wave 912 price-sweep code fix is local-only / not deployed yet.

3. A/B/C discovery workers are healthy but duplicate-heavy.
   - Latest examples:
     - A: `upserted_count=23`, `rawSkippedExisting=4323`, `detailFetched=5`
     - B: `upserted_count=134`, `rawSkippedExisting=1699`, `detailFetched=8`
     - C: `upserted_count=479`, `rawSkippedExisting=4521`, `detailFetched=6`
   - So discovery is working, but the detail budget is far too shallow relative to discovered rows.

4. Source health is not blocking the work.
   - `mvp_source_health.daangn.status=healthy`.

5. Found and fixed a local role-guard bug before deploy.
   - `CRON_PROJECT_ROLE=daangn_detail` would have been skipped by `cronProjectRoleSkip`.
   - Added explicit allow for `daangn_detail_worker`.
   - This only matters if we split detail worker into its own Vercel project; primary/all roles were already okay.

Verification after this review:

- `npx eslint src/lib/daangn-detail-backfill.ts src/app/api/cron/daangn-detail-worker/route.ts src/lib/cron-guard.ts src/app/api/cron/daangn-price-sweep-worker/route.ts src/lib/daangn-price-sweep.ts src/lib/daangn-ingest.ts`
- `npm run build`

Both passed.

Conclusion:

- The urgent fix is ready locally but not deployed.
- Production will not show the intended ready lift until the scoped deploy includes:
  - `src/lib/daangn-detail-backfill.ts`
  - `src/app/api/cron/daangn-detail-worker/route.ts`
  - `src/lib/cron-guard.ts`
  - `vercel.json`
  - Wave 912 price-sweep files
