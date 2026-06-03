# Wave 1032 — Worker Hotpath Stabilization

## Context

User asked whether workers were actually running and why bottlenecks kept recurring after previous hotpath fixes.

Current production read-only health check showed:

- Workers were alive: Daangn, score, recovery, tick locks/runs existed; no stale `collect_runs` running over 10 minutes.
- Source health was healthy for `daangn`, `joongna`, and `bunjang`.
- Current bottleneck was not source collection. It was downstream DB hotpaths:
  - `score_worker` had recent 57014 statement timeouts on scorable dirty fashion reserve reads.
  - `mvp_market_key_invalidation` had 9,755 pending rows, 8,826 older than 1 hour.

## Decisions

1. Keep the existing score pid-first hydration design, but remove the remaining broad fashion reserve scan.
   - Previous fix removed wide row scans, but the fashion reserve still used `or=(sku_id.like.shoe-*,sku_id.like.clothing-*)` before pid hydration.
   - Production REST showed the `like` form and even range form at `limit=120/40` could still time out for clothing.
   - Final code uses lexicographic range filters and per-lane scan caps:
     - shoe: `sku_id >= 'shoe-' and sku_id < 'shoe.'`, scan cap 40
     - clothing: `sku_id >= 'clothing-' and sku_id < 'clothing.'`, scan cap 10
   - Production REST verification of final shape:
     - shoe range type 40: 229 ms, 40 rows
     - clothing range type 10: 65 ms, 10 rows

2. Add a market invalidation stale lane instead of only increasing limits.
   - Previous priority window could keep old low-priority pending keys behind fresh high-priority keys.
   - Worker now claims a small oldest-pending lane alongside the priority lane.
   - Default stale lane is 40, not 100, because production oldest-pending read at 100 was near the statement timeout line before the new index is applied.

3. Add DB indexes for the two new stable reads.
   - `mvp_raw_listings_dirty_scorable_shoe_range_recent_idx`
   - `mvp_raw_listings_dirty_scorable_clothing_range_recent_idx`
   - `mvp_market_key_invalidation_pending_oldest_idx`

## Deferred

- Full `score_dirty` backlog count still times out through broad REST counts. Use targeted source/category counts or DB-side diagnostics instead of broad count endpoints.
- Daangn price sweep still has occasional 55P03 lock-timeout collisions. Current source health is healthy, so this was not expanded in this wave.
- Existing unrelated `core-rules` failure remains: AirPods 4 no-ANC catalog lane expectation. Not part of worker hotpath scope.

## Verification

- `node --test tests/score-worker-scorable-loader-contract.test.ts tests/fashion-parser-version-sync.test.ts tests/market-invalidation-priority-contract.test.ts` passed: 7/7.
- `npx eslint src/lib/tick-pipeline.ts tests/score-worker-scorable-loader-contract.test.ts tests/fashion-parser-version-sync.test.ts tests/market-invalidation-priority-contract.test.ts` had 0 errors and existing unused warnings only.
- `npx tsx --test tests/core-rules.test.ts` ran 120 tests: 119 passed, 1 unrelated AirPods 4 no-ANC failure.
