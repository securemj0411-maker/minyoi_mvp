# Wave 479 — Carhartt residual stale cleanup

Time: 2026-05-21 12:46 KST

## Context

After Wave 475, a fresh first-5,000 fashion audit surfaced another batch of `clothing-carhartt-apparel-broad` stale rows. These were not new parser issues; they were active DB rows that now reparse to narrower Carhartt lanes.

## Decisions

1. Migrate only rows where the current parser returns a Carhartt lane.
   - This avoids broad apparel samples absorbing repeated WIP/model families.

2. Do not add new Carhartt catalog lanes in this wave.
   - The current lanes already cover the residual examples.

## Applied

- DB:
  - Migrated 1 active stale row to `clothing-carhartt-madison-apparel-broad`.
  - Migrated 2 active stale rows to `clothing-carhartt-cargo-pants`.
  - Migrated 1 active stale row to `clothing-carhartt-santa-fe-jacket`.
  - Migrated 3 active stale rows to `clothing-carhartt-double-knee-pants`.

## Verification

- Prior parser regression suite in this wave set:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 175 passed, 0 failed.
- `npx tsx scripts/wave479-carhartt-residual-stale-apply.ts`
  - post-apply `totalActions=0`, `holdCount=0`.

## Deferred

- Continue monitoring for Carhartt WIP model families that may justify separate lanes once repeated clean samples accumulate.
