# Wave 476 — Arc'teryx broad stale cleanup

Time: 2026-05-21 12:35 KST

## Context

After Carhartt cleanup, `clothing-arcteryx` became the top first-5,000 fashion drift group.

The current catalog intentionally excludes `크래그` / `crag` from generic Arc'teryx broad because the term has been a source of shoe/apparel ambiguity. The stale DB rows under broad were mostly Crag apparel:

- Crag cotton pants
- Crag SL cotton short-sleeve tees

These should not remain in the generic Arc'teryx apparel sample. Pants and tees also should not be merged into one catch-all comparable group.

## Decisions

1. Keep Crag out of generic Arc'teryx broad.
   - Crag apparel is not promoted into the broad fallback.
   - Dedicated Crag apparel lanes are deferred until enough clean sample volume exists by product type.

2. Move only explicit narrow model matches.
   - One listing with Squamish in the description/query was migrated to `clothing-arcteryx-vertex-squamish`.

3. Clear current parser rejects.
   - Seven Crag stale broad rows were cleared rather than kept in broad.

## Applied

- Tests: added regression coverage that Crag pants/tees do not enter generic Arc'teryx broad.
- DB:
  - Migrated 1 active stale row to `clothing-arcteryx-vertex-squamish`.
  - Cleared 7 active stale rows from `clothing-arcteryx`.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 175 passed, 0 failed.
- `npx tsx scripts/wave476-arcteryx-broad-stale-apply.ts`
  - post-apply `totalActions=0`, `holdCount=0`.

## Deferred

- Dedicated Arc'teryx Crag pants lane.
- Dedicated Arc'teryx Crag short-sleeve / cotton tee lane.
