# Wave 1034 — Worker Ops Audit And Index Apply

## Context

User requested a stricter full investigation before more worker fixes.

The first broad SQL audit attempt was intentionally killed because exact counts across the largest tables made the audit itself too heavy. Decision: future worker audits must use bounded/sample/planned-count checks, not broad exact counts.

## Findings

1. Supabase CLI is not linked and remote migration history does not match local migrations.
   - `supabase db push --dry-run` failed with missing remote migration versions.
   - Therefore migration files alone would not currently apply to production.

2. Production DB was missing the new worker hotpath indexes.
   - Initial `pg_index` check found no new score fashion / market oldest-pending indexes.

3. Production had invalid index residue.
   - `mvp_raw_listings_dead_last_changed_idx` was `indisvalid=false`.
   - First direct concurrent index attempt with 5s lock timeout also left invalid stubs for market/clothing, which were then dropped and rebuilt.

4. Current remaining backlog is queue drain, not dead workers.
   - Market invalidation pending remained around 9.9k.
   - Latest source health returned to healthy after index build activity.

5. Recovery worker stale markers were a separate residual issue.
   - Repeated `stale running run auto-marked after 8m` rows indicate the 60s recovery route can be killed before it records a clean failure/success.
   - Recovery had been implicitly scanning up to 250 candidates despite doing raw/listing/parsed hydration plus market-stat lookups.

## Decisions / Changes

- Applied the DB indexes directly with `CREATE INDEX CONCURRENTLY`, because CLI migration push is blocked:
  - `mvp_raw_listings_dirty_scorable_shoe_range_recent_idx`
  - `mvp_raw_listings_dirty_scorable_clothing_range_recent_idx`
  - `mvp_market_key_invalidation_pending_oldest_idx`
  - rebuilt `mvp_raw_listings_dead_last_changed_idx`
- Kept local migration files for repo parity:
  - `20260604102000_wave1031_market_invalidation_stale_lane_idx.sql`
  - `20260604102500_wave1032_score_fashion_range_idx.sql`
  - `20260604103000_wave1033_repair_invalid_dead_index.sql`
- Changed recovery worker config:
  - added `PIPELINE_RECOVERY_LIMIT`
  - default is 100, min 10, max 250
  - `recoveryStage()` now uses `config.recoveryLimit`

## Verification

- All four target indexes are valid/ready in production.
- Invalid public indexes after rebuild: 0.
- Final spot check at 2026-06-04 02:38 KST:
  - invalid public indexes: 0
  - source health: `bunjang`, `daangn`, `joongna` all healthy
  - stale `mvp_collect_runs` still running over 10 minutes: 0
  - market invalidation pending: 9,862, with 8,928 older than 1 hour
  - `mvp_detail_queue` pending/processing rows in bounded status check: 0
- REST hotpath verification after index apply:
  - old OR fashion query, limit 120: 920 ms
  - shoe range limit 40: 163 ms
  - clothing range limit 10: 56 ms
  - clothing range limit 40 probe: 56 ms
  - market oldest pending limit 40: 326 ms
  - market oldest pending limit 100 probe: 365 ms
- Contract tests:
  - `node --test tests/score-worker-scorable-loader-contract.test.ts tests/fashion-parser-version-sync.test.ts tests/market-invalidation-priority-contract.test.ts tests/recovery-worker-contract.test.ts` passed 8/8.
- ESLint:
  - 0 errors, existing unused warnings only.

## Deferred / Next

- Deploy code so production workers use the range/cap path and recovery limit change. DB indexes already make the old OR query fast, but deployment removes the bad query shape entirely.
- Reconcile Supabase migration history before relying on `supabase db push`.
- Watch market invalidation pending count over the next worker cycles; stale lane/index should make the old queue drain rather than starve.
