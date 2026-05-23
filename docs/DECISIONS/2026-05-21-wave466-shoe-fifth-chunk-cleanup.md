# Wave 466 — shoe fifth chunk cleanup

Time: 2026-05-21 11:12 KST

## Context

Audited active shoe rows at offset 10,000-12,500. Initial drift had 17 groups, mostly stale labels from broad shoe lanes absorbing bags, apparel, other collaborations, or buy-request rows.

- Salomon ACS Pro contained ACS bags and duplicate ACS Pro rows assigned to the older SKU.
- Nike x Levi's Air Max 95 contained trucker/apparel/Air Jordan 3/custom pants rows.
- Salomon XT, Nike x Sacai, Puma, Polo loafer, and On Running lanes contained unrelated collab, apparel, or buy-request rows.
- A normal Nike x Sacai Blazer row was being blocked by `고트 구매`, which is a purchase-history phrase, not a buy request.

## Decisions

1. Keep intended rows by tightening parser exceptions, not by widening broad lanes.
   - Added `acs프로` to Salomon ACS Pro broad matching.
   - Allowed Salomon ACS Pro `오프화이트` as a color phrase when it is not an Off-White collab.
   - Added Salomon XT-4 glued/spacing variants, RRL roughout sneaker variants, and Nike SFB6 variants.
   - Allowed denim material text for intended denim shoe lanes: Nike x Levi's, Puma Palermo, and Loewe x On Cloudtilt.
   - Treated `고트/GOAT 구매` as purchase provenance so Nike x Sacai Blazer stays matched.

2. Clear rows whose title/description proves they are not comparable with the old SKU.
   - Cleared Salomon ACS bags from ACS Pro.
   - Migrated duplicate Salomon ACS Pro rows from `shoe-salomon-acs-pro` to `shoe-salomon-acs-pro-broad`.
   - Cleared Nike x Levi's non-Air-Max-95 rows: trucker, track pants, Air Jordan 3, and custom pants.
   - Cleared JJJJound/Kith/Palace/COSTS/COTD/KAWS triple-collab rows from plain or different-collab lanes.
   - Cleared Beverly Hills Polo Club / keyword spam from Polo loafer.
   - Cleared Puma Velcro SoftFoam sneaker from Puma football.
   - Cleared On Running Cloudmonster buy-request/dummy-price row.

## Applied

- DB: cleaned 30 active rows in this chunk.
  - 3 Salomon ACS duplicate rows migrated to `shoe-salomon-acs-pro-broad`.
  - 27 stale rows cleared from active comparable pools.
- Parser/catalog: added conservative aliases/material exceptions and purchase-provenance handling.
- Tests: added Nike x Sacai `고트 구매` regression to `tests/wave254-6-product-type-priority.test.ts`.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 164 passed, 0 failed.
- `START_OFFSET=10000 MAX_ROWS=2500 PAGE_LIMIT=250 npx tsx scripts/wave466-shoe-currentdiff-audit.ts`
  - scanned 2,500 active shoe rows.
  - `groupsWithDiff=0`, `ranked=[]`.

## Deferred

- Continue active shoe current-diff audit from offset 12,500.
- Size/turnover bucketing remains deferred for a separate wave.
