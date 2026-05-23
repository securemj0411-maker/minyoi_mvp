# Wave 471 — Chanel broad obvious clear

Time: 2026-05-21 13:02 KST

## Context

After LV key pouch cleanup, `bag-chanel-broad` was the next high drift group in the first-5,000 fashion audit.

The drift mixed two very different cases:

- Clear non-bag rows: beauty cushion/refill/powder listings, apparel, and paper shopping bag bundles.
- Ambiguous high-value bag candidates: Chanel cosmetic/vanity bag, wallet-on-chain style rows, Gabrielle hobo, and New Surf shopping-bag model wording.

## Decisions

1. Clear only obvious non-bag Chanel broad rows in this wave.
   - Beauty products with gift shopping-bag packaging are not bag comparables.
   - Apparel rows are not bag comparables.
   - Low-value paper shopping-bag bundles are not bag comparables.

2. Hold ambiguous high-value Chanel rows.
   - `코스메틱백`, `미니체인가방`, `참월렛 체인`, and `뉴서프 쇼핑백` may be real Chanel bag model families.
   - They should be modeled as narrow lanes or reviewed together, not blindly cleared from the catalog.

3. Fix purchase-history date parsing.
   - `2021.05 구매 30번대` in a legitimate luxury listing was being interpreted as a buy request because `구매` was followed by a serial-like number on the next line.
   - Year/month purchase-history wording now bypasses the buy-request marker.

## Applied

- Parser/catalog: added a purchase-history guard for `YYYY.MM 구매` / `YYYY-MM 구매` style wording.
- DB: cleared 7 active obvious non-bag rows from `bag-chanel-broad`.
- Held ambiguous active rows for future modeling:
  - Chanel cosmetic/vanity bag candidates.
  - Chanel wallet-on-chain / chain wallet candidate.
  - Chanel New Surf shopping-bag wording.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 169 passed, 0 failed.
- `npx tsx scripts/wave471-chanel-broad-obvious-clear.ts`
  - post-apply `totalActions=0`.
  - 6 rows remain in `heldAmbiguous` by design.

## Deferred

- Chanel WOC / chain wallet and Chanel vanity/cosmetic bag narrow lanes.
- Whether high-value `쇼핑백` wording is an actual Chanel model family or packaging noise must be handled separately.
