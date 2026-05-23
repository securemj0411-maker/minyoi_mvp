# Wave 475 — Carhartt broad stale cleanup

Time: 2026-05-21 12:30 KST

## Context

After LV Alma BB cleanup, `clothing-carhartt-apparel-broad` became the top first-5,000 fashion drift group.

Most drift was not a new parser failure. The current parser already routes repeated Carhartt pants families away from broad apparel, but older DB rows were still stored under the broad SKU:

- Cargo pants / cargo shorts
- Double Knee pants
- Landon shorts previously leaking into Landon pants through `반바지`

## Decisions

1. Move stale broad rows into current narrow Carhartt lanes when the current parser identifies a Carhartt lane.
   - Cargo pants / shorts rows move to `clothing-carhartt-cargo-pants`.
   - Double Knee rows move to `clothing-carhartt-double-knee-pants`.

2. Clear rows that the current parser rejects.
   - These should not remain in a reusable broad apparel price sample.

3. Keep Landon pants from absorbing shorts.
   - `쇼츠`, `shorts`, `반바지`, and `숏팬츠` now block `clothing-carhartt-landon-pants`.
   - A dedicated Landon shorts lane is deferred until repeated clean sample volume is available.

## Applied

- Parser/catalog: blocked shorts terms from `clothing-carhartt-landon-pants`.
- Tests: added regression coverage to ensure `칼하트 랜든 쇼츠 반바지` does not enter Landon pants.
- DB:
  - Migrated 3 active stale rows to `clothing-carhartt-cargo-pants`.
  - Migrated 2 active stale rows to `clothing-carhartt-double-knee-pants`.
  - Cleared 3 active stale rows from `clothing-carhartt-apparel-broad`.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 174 passed, 0 failed.
- `npx tsx scripts/wave475-carhartt-broad-stale-apply.ts`
  - post-apply `totalActions=0`, `holdCount=0`.

## Deferred

- Dedicated Carhartt Chase sweatshirt / crewneck lane.
- Dedicated Carhartt Landon shorts lane.
