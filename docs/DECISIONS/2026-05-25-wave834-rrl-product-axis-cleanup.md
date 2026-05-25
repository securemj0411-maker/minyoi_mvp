# Wave834 RRL product-axis cleanup

Date: 2026-05-25

## Context

Operator feedback flagged RRL comparisons where pants and shirts appeared to be mixed.
The current catalog already blocks `polo_rrl` broad fallback and releases only narrow lanes, but current parsed rows still had stale broad/denim assignments.

Additional dry-run inspection found two concrete risks:

- `리미티드 에디션 ... 팬츠` was able to enter ready `polo_rrl_pants`.
- `필드팬츠` rows could enter `polo_rrl_denim` because description text mentioned denim-adjacent model/color words such as `에크루` / `빈파포`.

## Decision

Keep RRL narrow lanes ready, but tighten outlier and field-pants leakage.

- `polo_rrl_pants` now rejects limited-edition wording.
- `polo_rrl_denim` now rejects `필드팬츠` / `field pants` wording so non-denim field pants fall back to blocked broad/internal instead of ready denim.
- RRL broad remains blocked; reclassifying rows to `polo_rrl_broad` is safe because it cannot enter public pool.

## DB Backfill

Applied with `scripts/apply-fashion-current-catalog-reclassify.ts --apply`.

- scanned parsed rows: 172
- candidate rows: 87
- reclassified: 13
- refreshed parsed keys: 44
- rejected: 30

Representative changes:

- `407816683` / `408693838` field-pants rows moved out of ready denim into blocked broad/internal.
- `403573929` limited-edition pants rejected.
- Explicit RRL denim/pants/shirt rows such as Givins, Vintage Five Pocket, officer chino, work/chore, and denim shirt were refreshed or moved to their current narrow lanes.

## Verification

- Direct checks:
  - `RRL 리미티드 에디션 인디고 헤링본 팬츠 32x32` -> null
  - `더블알엘 필드팬츠 시디드 네추럴 34x32 RRL` -> blocked broad, not denim
  - `RRL 더블알엘 치노 팬츠 32` -> `clothing-polo-rrl-pants`
  - `RRL 더블알엘 데님 셔츠` -> `clothing-polo-rrl-denim`
- `npx tsx --test tests/fashion-catalog-regression.test.ts` passed: 38/38.
- `scripts/run-market-stats-stage-once.ts` completed and upserted 1587 pool rows.
- `scripts/cleanup-fashion-pool-gate-blocked.ts --apply` found 0 gate-blocked ready rows.

## Deferred

`polo_rrl_denim` still appears in `probably_safe` due historical feedback, but current counters remain clean. Keep ready and continue monitoring product-type sample display, especially denim shirt vs denim pants keys.
