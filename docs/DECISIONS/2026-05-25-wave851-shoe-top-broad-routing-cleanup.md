# Wave 851 — Shoe top broad routing cleanup

## Context

After wave 850, shoe safety still had large watch/internal broad groups with current rows that could either refresh, split to known exact lanes, or reveal new pollution. The reviewed top broad groups were:

- New Balance 327 broad
- Gucci broad
- Converse Chuck 70 High broad
- Adidas Tobacco broad
- Prada broad
- New Balance 574 broad
- Nike Shox R4 broad
- Balenciaga Triple S broad
- Adidas Superstar broad
- Hermes broad

## Decisions

1. Keep reviewed broad shoe lanes internal/watch-only.
   - No broad shoe family was promoted to public readiness.
2. Add or use narrow/internal lanes where the title clearly exposes a distinct product axis.
   - Converse Chuck 70 Plus High -> `shoe-converse-chuck70-plus-high`
   - Prada America Cup -> `shoe-prada-america-cup`
   - Hermes Oran Sandal -> `shoe-hermes-oran-sandal`
   - Adidas Superstar Pufflet -> `shoe-adidas-superstar-pufflet`
3. Keep known non-comparable/collab pollution out of broad.
   - Converse x Slam Jam Chuck 70 remains null.
   - New Balance 574 "신발 2개" bundle rows are rejected as non-comparable.
4. Fix a false reject without weakening bundle defenses.
   - `구찌 스니커즈(구찌 풀박세트, 정품)` now stays Gucci shoe broad because "풀박세트/풀박스 + strong shoe signal" is a shoe full-package phrase.
   - Box-only / dustbag-only / shoe-box-only rows remain rejected.

## Applied DB routing

Wave 851 apply:

- scannedParsedRows: 571
- rawRows: 571
- candidateRows: 145
- reclassifyRows: 11
- refreshParsedRows: 132
- rejectRows: 2

Notable routing:

- `shoe-hermes-broad` -> `shoe-hermes-oran-sandal` (4 rows)
- `shoe-prada-broad` -> `shoe-prada-america-cup` (4 rows)
- `shoe-converse-chuck70-high-broad` -> `shoe-converse-chuck70-plus-high` (1 row)
- `shoe-adidas-superstar-broad` -> `shoe-adidas-superstar-pufflet` (1 row)
- `shoe-adidas-superstar-broad` -> `shoe-wotherspoon-adidas-superstar` (1 row)
- `shoe-converse-chuck70-high-broad` -> null for Slam Jam collab (1 row)
- `shoe-newbalance-574-broad` -> null for "신발 2개" bundle (1 row)

## Verification

- Regression: `npx tsx --test tests/fashion-catalog-regression.test.ts` passed 50/50.
- Stage after apply:
  - queued: 32
  - poolUpserted: 528
  - reveal_current_profit_updated: 0
  - reveal_current_profit_invalidated: 0
- Gate cleanup:
  - 3 shoe rows cleaned.
- Safety after wave 851:
  - clothing readySku 46, safe_public 38, probably_safe 8, fix_now 0
  - shoe had one remaining fix_now: `shoe-mizuno-wave-prophecy`

## Deferred

- Gucci, Prada, Hermes, NB327/NB574, Chuck70 High, Shox R4, Triple S, Tobacco, and Superstar broad lanes remain internal/watch-only.
- Gucci broad still needs future exact model splits once recurring model names have enough clean samples.
- Shoe bundle wording beyond "신발/운동화/스니커즈/슈즈 2-3개" should continue to be watched in raw sweeps.
