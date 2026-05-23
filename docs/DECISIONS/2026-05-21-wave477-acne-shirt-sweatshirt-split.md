# Wave 477 — Acne shirt / sweatshirt split

Time: 2026-05-21 12:39 KST

## Context

After Arc'teryx cleanup, `clothing-acne-shirt` was a top fashion drift group.

The stale rows showed a root product-type issue: Korean sweatshirt wording such as `스웻셔츠` / `스웨트셔츠` had been stored under the shirt lane because it contains `셔츠`. These rows are not comparable with button shirts or blouses.

## Decisions

1. Route sweatshirt wording to Acne sweat.
   - Added explicit `스웻셔츠`, `스웨트셔츠`, `스웨트 셔츠`, `sweatshirt`, and `sweat shirt` signals to `clothing-acne-sweat`.

2. Block sweatshirt wording from Acne shirt.
   - `clothing-acne-shirt` now rejects sweat/hoodie/crewneck/Forba/Flogho wording.

3. Migrate stale shirt rows to the current safer lane.
   - Sweatshirt/crewneck/Forba rows move to `clothing-acne-sweat`.
   - Polo wording moves to `clothing-acne-polo`.

## Applied

- Parser/catalog: tightened Acne sweat/shirt routing.
- Tests: added Acne sweatshirt regression samples.
- DB:
  - Migrated 7 active stale rows from `clothing-acne-shirt` to `clothing-acne-sweat`.
  - Migrated 1 active stale row from `clothing-acne-shirt` to `clothing-acne-polo`.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 175 passed, 0 failed.
- `npx tsx scripts/wave477-acne-shirt-stale-apply.ts`
  - post-apply `totalActions=0`, `holdCount=0`.

## Deferred

- Separate Acne Forba/Flogho/Fairview sweatshirt sublanes are deferred until sample volume is clean enough per model.
