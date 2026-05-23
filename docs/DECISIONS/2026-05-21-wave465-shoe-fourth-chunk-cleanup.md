# Wave 465 — shoe fourth chunk cleanup

Time: 2026-05-21 11:40 KST

## Context

Audited active shoe rows at offset 7,500-10,000. Initial drift had 14 groups, mostly old SKU assignments caused by loose numeric/model matching:

- New Balance 990v5 contained 410v5, 480v5, PureCell SC Elite v5, Rebel v5, and Propel v5.
- New Balance 990v3/990v4 contained JJJJound/Kith/Joe Freshgoods collabs.
- Jordan 1 lanes contained Jordan 11 and Off-White collab rows.
- Nike Air Max / Blazer / Cortez broad lanes contained collab, golf, or other-model variants.

## Decisions

1. Clear stale rows where the title proves a different model/collab.
   - Removed non-990 New Balance v5/v6 rows from 990v5/990v6.
   - Removed JJJJound/Kith/Joe Freshgoods 990v3/990v4 rows from plain 990v3/990v4.
   - Removed Jordan 11 rows from Jordan 1 Shadow/UNC lanes.
   - Removed Off-White Jordan/Cortez/Blazer rows from plain lanes.
   - Removed Air Max 1 rows that were Air Max 180/1000/golf/Sneakerboot/Ambush.
   - Removed Air Max 90G/97G golf variants and Palace Air Max 95.
   - Removed box-only New Balance 992 and wrong-color Dunk Low row.

2. Preserve real intended rows with conservative alias fixes.
   - Added glued Air Max Korean forms (`나이키에어맥스95`, `에어맥스95OG/SE`, `나이키에어맥스97`, `에어맥스90다크`).
   - Allowed New Balance x Levi's denim 990v3 typo `99Ov3`.
   - Allowed `데님` for the New Balance x Levi's shoe collab so material text does not trip the shoe-vs-clothing guard.
   - Added `조던1x` for Travis Scott Jordan 1 Low Mocha so `조던1x트래비스...` stays in the intended collab SKU.

## Applied

- DB: cleared 70 stale active rows.
- Parser/catalog: added Nike Air Max glued-form aliases, Levi's collab typo/material handling, and Travis Jordan glued collab handling.
- Tests: added regression cases to `tests/wave254-6-product-type-priority.test.ts`.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 164 passed, 0 failed.
- `START_OFFSET=7500 MAX_ROWS=2500 PAGE_LIMIT=250 npx tsx scripts/wave465-shoe-currentdiff-audit.ts`
  - scanned 2,500 active shoe rows.
  - `groupsWithDiff=0`, `ranked=[]`.

## Deferred

- Continue active shoe current-diff audit from offset 10,000.
- Size/turnover bucketing remains deferred.
