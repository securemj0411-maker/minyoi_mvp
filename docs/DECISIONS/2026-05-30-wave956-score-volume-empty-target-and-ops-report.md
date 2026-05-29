# 2026-05-30 Wave 956 — Score Volume Empty Target And Ops Report

## Context

After the Daangn nearby feed work, the next bottleneck check used the existing operational reports plus a narrow live Supabase REST probe.

Observed:
- `report-db-hotpaths` over the latest 6h showed cumulative function time dominated by `daangn_detail_worker`, and cumulative DB time heavily affected by score/volume-gate paths.
- `pg_stat_statements` showed a repeated 7-day `mvp_raw_listings.sku_id like shoe-/clothing-/bag-` scan pattern.
- `report-unit-economics` printed `ready pool = 63`, but a paged live probe over `mvp_candidate_pool` found 4,005 ready rows in the fetched 12k rows, including 3,185 Daangn ready rows.

The `63` value was therefore not a production pool collapse; it was an ops-report sampling bug caused by PostgREST's page cap.

## Decision

Fix two low-risk issues before adding more cron capacity:

1. Empty explicit score-gate target sets should not fall back to global 7-day scans.
   - `loadDaangnVolumeBySku(new Set())` now returns an empty map.
   - `loadLowVolumeSkuIds(new Set())` now returns an empty set.
   - The old fallback remains only for callers that truly omit the target argument.

2. `report-unit-economics` should page large tables instead of trusting `limit=20000`.
   - Candidate pool, detail queue, and market invalidation queue now use offset pagination.
   - This avoids misleading ready-pool counts in operator decisions.

## Why

Score workers always pass explicit target sets from the current score batch. When a batch has no Daangn targets or no fashion low-volume targets, scanning a broad 7-day global window is pure waste. Removing that scan reduces DB read load without reducing candidate quality.

## Deferred

- No DB index or migration was applied in this wave.
- `report-all-category-funnel` still has a broad catalog SKU scan that can timeout. It should be rewritten separately as a paged/narrow report before relying on it for production decisions.
- `daangn_detail_worker` remains the largest runtime consumer. The next tuning pass should look at detail worker concurrency/budget and whether all missing-manner rows need immediate detail fetch priority.

## Verification Plan

- Run focused tests/build after code change.
- Re-run `report-db-hotpaths` after a few cron cycles and verify the broad empty-target volume scan drops from the recent hot path.
