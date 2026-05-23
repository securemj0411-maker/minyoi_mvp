# Wave 473 — Adidas Trefoil collab clear

Time: 2026-05-21 13:31 KST

## Context

After Celine Triomphe recovery, `clothing-adidas-trefoil` was the next high drift group in the first-5,000 fashion audit.

The stale rows were high-variance collaboration apparel:

- Adidas × Thug Club track tops / track pants
- Adidas × Fear of God Athletics sweatpants

These are not comparable with plain Adidas Trefoil / 3-stripe apparel.

## Decisions

1. Clear high-variance Adidas collaboration rows from plain Trefoil.
   - Thug Club and Fear of God Athletics have distinct demand and price behavior.
   - They should not remain in `clothing-adidas-trefoil`.

2. Defer dedicated collaboration apparel lanes.
   - Current sample volume is enough to justify exclusion from Trefoil, but not enough yet to model stable resale curves per collab apparel lane.

## Applied

- Parser/tests: added regression coverage to ensure Thug Club / Fear of God Adidas apparel does not match plain Trefoil.
- DB: cleared 10 active stale rows from `clothing-adidas-trefoil`.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 172 passed, 0 failed.
- `npx tsx scripts/wave473-adidas-trefoil-collab-clear.ts`
  - post-apply `totalActions=0`, `held=[]`.

## Deferred

- Dedicated Adidas × Thug Club and Adidas × Fear of God apparel lanes.
