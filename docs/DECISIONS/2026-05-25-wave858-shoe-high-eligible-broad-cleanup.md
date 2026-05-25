# Wave 858 — Shoe high-eligible broad cleanup

## Context

After wave 857, shoe safety had no `fix_now`, but high-eligible `watch_internal_only` broad lanes still had stale rows worth backfilling. This wave reviewed:

- `shoe-newbalance-327-broad`
- `shoe-gucci-broad`
- `shoe-converse-chuck70-high-broad`
- `shoe-adidas-tobacco-broad`
- `shoe-prada-broad`
- `shoe-newbalance-574-broad`
- `shoe-nike-shox-r4-broad`
- `shoe-balenciaga-triple-s-broad`
- `shoe-nike-cortez-broad`
- `shoe-adidas-superstar-broad`

## Decisions

1. Keep Chuck70 High broad, but remove special Kim Jones Utility Wave rows and route explicit Chuck70 Plus High rows to the Plus High lane.
2. Keep plain New Balance 574 broad as a fallback, but block collab rows that were polluting samples:
   - Miu Miu x New Balance 574
   - Stray Rats x New Balance 574
3. Route New Balance 574 x Tokyo Design Studio rows to the existing TDS collab lane.
4. Keep Adidas Superstar broad, but block newly observed special/collab pollutants:
   - golf shoe rows
   - Disney rows
   - Caroline Hu/Caroline rows
5. Do not promote the audited broad lanes just from this pass. The goal was backfill/sample cleanup, not public release.

## Code changes

- Added New Balance 574 broad blockers for Miu Miu and Stray Rats wording.
- Added Adidas Superstar broad blocker for Caroline Hu/Caroline/캐롤라인.
- Added regression coverage for:
  - NB574 collab blockers while plain 574 remains matched
  - Caroline Superstar blocker

## Applied DB routing

Wave 858 broad batch apply:

- scannedParsedRows: 866
- rawRows: 866
- candidateRows: 58
- reclassifyRows: 3
- refreshParsedRows: 48
- rejectRows: 7

Notable rows:

- `shoe-converse-chuck70-high-broad` -> `shoe-converse-chuck70-plus-high`: pids `409408305`, `409400012`
- `shoe-converse-chuck70-high-broad` -> null/review: Kim Jones Utility Wave rows
- `shoe-newbalance-574-broad` -> `shoe-newbalance-tds-collab`: pid `376378719`
- `shoe-newbalance-574-broad` -> null/review: Miu Miu 574 and Stray Rats 574 rows
- `shoe-adidas-superstar-broad` -> null/review: golf shoe, Disney, and Caroline rows

## Verification

- Regression: `npx tsx --test tests/fashion-catalog-regression.test.ts` passed 57/57.
- Stage after apply:
  - queued: 22
  - poolUpserted: 414
  - reveal_current_profit_updated: 1
  - reveal_current_profit_invalidated: 1
- Gate cleanup:
  - first pass candidateRows: 1, applied shoe rows: 1
  - final pass candidateRows: 0
- Final safety:
  - shoe readySku 83, safe_public 80, probably_safe 3, fix_now 0
  - clothing readySku 49, safe_public 41, probably_safe 8, fix_now 0

## Deferred

- Continue with the next high-eligible `watch_internal_only` shoe broad lanes: Dior, Hermes, Nike Tiempo, Nike Mercurial, New Balance 530, Louis Vuitton, Shox TL, Converse Chuck All Star, Vans Vault, Dr. Martens broad, plus remaining luxury/high-spread broad families.
- NB327, Gucci broad, Tobacco, Prada, Shox R4, Triple S, and Cortez had no deterministic pollution in this pass beyond refreshes, but they remain internal watch until exact sample quality is proven.
