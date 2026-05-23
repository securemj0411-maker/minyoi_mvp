# Wave 472 — Celine Triomphe family split

Time: 2026-05-21 13:18 KST

## Context

After Chanel cleanup, `bag-celine-broad` became the top first-5,000 fashion drift group. The examples were mostly real Celine Triomphe family bags:

- Triomphe oval bag
- Triomphe bucket bag
- Triomphe Folco backpack
- Triomphe Besace
- Triomphe hobo

The old generic Celine broad intentionally blocked `트리옹프` to avoid mixing it into generic Celine bag fallback, but no replacement Triomphe lane existed.

## Decisions

1. Add a separate Celine Triomphe family lane.
   - `bag-celine-triomphe-broad` is broad within the Triomphe family, but separated from generic Celine broad.
   - This preserves real high-value bag candidates without dumping all Triomphe variants into generic Celine.

2. Keep paper shopping bags out.
   - Low-value Celine paper shopping-bag rows are packaging noise, not bag comparables.

## Applied

- Parser/catalog: added `bag-celine-triomphe-broad`.
- DB:
  - Migrated 10 active `bag-celine-broad` rows into `bag-celine-triomphe-broad`.
  - Cleared 1 active Celine paper shopping-bag row.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 171 passed, 0 failed.
- `npx tsx scripts/wave472-celine-triomphe-apply.ts`
  - post-apply `totalActions=0`, `held=[]`.

## Deferred

- Exact Triomphe sub-variant lanes are deferred until enough repeated sample volume exists per shape.
- Chanel WOC/cosmetic-bag ambiguous rows remain deferred from Wave 471.
