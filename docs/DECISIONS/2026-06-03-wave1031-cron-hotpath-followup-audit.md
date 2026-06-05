# Wave 1031 — Cron hotpath follow-up audit

Date: 2026-06-03

## Trigger

Recent Telegram alerts still mentioned `score_worker`, `Warmer`, `Market`, and lifecycle-related
warnings after multiple hotpath fixes. The goal was to distinguish:

- already-fixed alerts that are still included in older 12h windows
- currently active operational bottlenecks
- next non-destructive fixes worth doing

## Read-Only Production Snapshot

Last 12h `mvp_collect_runs` sample showed:

- `score-worker`: 16 failures / 110 total, latest runs succeeding after Wave 1029
- `score-worker-b`: 1 stale failure / 122 total, latest succeeding
- `score-worker-c`: 1 stale failure / 119 total, latest succeeding
- `lifecycle-worker`: 0 failed / 24 total, but 24 `timedOut=true`
- `lifecycle-worker-b`: 0 failed / 25 total, 7 `timedOut=true`
- `lifecycle-worker-c`: 0 failed / 25 total, 3 `timedOut=true`
- `pool-warmer`: 0 failed / 16 total, but 16 `timedOut=true`
- `market-worker`: 0 failed / 12 total
- `housekeeper`: 0 failed / 4 total

Important: the `score-worker` failure rate in the 12h aggregate includes failures from before
Wave 1029 deployed. Latest A/B/C score runs are succeeding, so score-worker is no longer the first
remaining target unless fresh alerts continue after the deploy window.

## Active Bottlenecks

### 1. Lifecycle claim latency

Latest lifecycle runs are mostly successful, but the claim phase is still expensive.

Observed examples:

- primary lifecycle claim: about 13s-60s, often `timedOut=true`
- `lifecycle-worker-b` claim: up to about 75s in the inspected recent runs
- `lifecycle-worker-c` claim: sometimes fast, sometimes 40s-75s

The lifecycle worker is doing useful work again after Wave 1013, but the claim query itself remains
a hot DB path.

Existing schema has:

- general expression index matching priority order:
  `mvp_lifecycle_checks_claim_expr_idx`
- but source/shard lanes still filter by `source='daangn'` and `pid % 3 = shard`.

Likely next fix:

- add a source/shard-aware claim index or adjust the claim RPC to use a claim shape that the planner
  can use reliably for Daangn shard lanes.

This should be treated as a schema/index wave and reviewed before applying.

### 2. Velocity sync large-category timeout

Latest `sync-market-velocity` runs confirm Wave 1030's suspicion.

Recent per-category examples:

- `2026-06-03 06:15 UTC`
  - `clothing`: 60s statement timeout
  - `shoe`: 60s statement timeout
  - other categories continued and 4,542 rows were upserted
- `2026-06-02 18:15 UTC`
  - `clothing`, `shoe`, `smartphone`, `bag`, `earphone` all timed out
  - route reached deadline and skipped the rest
- `2026-06-02 12:15 UTC`
  - `clothing` succeeded at 59.4s
  - `shoe` succeeded at 48.3s
  - several tail categories skipped due route deadline

Conclusion:

- category-level split was necessary, but `clothing` and `shoe` are now near the 60s edge or over it.
- this directly affects user-facing velocity coverage and "표본 부족" frequency.

Likely next fix:

- split velocity sync further for large categories, preferably by stable source or comparable-key bucket.
- keep it upsert-only and non-destructive.

### 3. Pool-warmer time budget

`pool-warmer` currently succeeds but every inspected recent run had `timedOut=true`.

Code review shows `poolWarmerStage()` verifies ready pool rows sequentially. Because source-aware
verification can call Daangn/Joongna/Bunjang detail fetches with 10s timeouts, a few slow rows can
consume the 20s detail budget.

Likely next fix:

- process pool-warmer rows in small concurrent waves.
- keep concurrency conservative so it does not increase marketplace pressure meaningfully.
- preserve detail-access live verification as the final safety gate.

## Do Not Change Yet

- Do not loosen alert thresholds just to stop Telegram noise.
- Do not lower velocity usability thresholds as the primary fix; that would make weak samples look
  more confident than they are.
- Do not bulk-delete lifecycle rows or ready rows to make counts look healthier.

## Recommended Order

1. Velocity large-category split.
   - Most directly explains user-facing "표본 부족".
   - Non-destructive if implemented as upsert-only bucket/source sync.
2. Lifecycle source/shard claim index/RPC review.
   - Important for sold/disappeared detection and Daangn lifecycle freshness.
   - Requires schema/index care.
3. Pool-warmer concurrent wave.
   - Lower risk code-only throughput improvement.
   - Helps ready pool validation but is less central than lifecycle/velocity.

## Current Status

- No data mutation was performed during this audit.
- No alert was muted.
- No production cadence was increased.
