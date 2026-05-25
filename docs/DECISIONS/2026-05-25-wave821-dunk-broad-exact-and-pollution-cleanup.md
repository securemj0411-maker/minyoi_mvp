# Wave 821 Nike Dunk Low Broad Exact Promotion And Pollution Cleanup

Date: 2026-05-25

## Context
- Continued shoe sample-safety sweep after CDG Nike, NB327/Chuck70, Mercurial, and Superstar cleanup.
- `shoe-nike-dunk-low-broad` had a large eligible backlog but should not be public-comparable when it absorbs SB, golf, Twist, Gore-Tex, Premium/SP/QS, collab, custom, or reform rows.
- Fresh raw/parsed DB rows showed broad Dunk was also hiding valid exact colorway lanes because several exact SKUs did not have explicit `laneKey`.

## Findings
- Broad pollutants found in current DB samples:
  - Nike Golf Dunk Low Securis golf shoes.
  - Women's Dunk Low Twist.
  - SB rows: Powerpuff, Neckface, QuarterSnacks, Habibi, Lobster, Chlorophyll, skate/camo rows.
  - Atmos, Doernbecher, Harris Tweed, Gore-Tex, NBA, Banana, Next Nature, Premium/SP/QS.
  - Customized/reformed rows that should not be used as market comparables.
- Systemic root cause:
  - `chooseUniqueCandidate` and `tryNarrowLanePromotion` only trusted explicit `sku.laneKey`.
  - Some ready exact Dunk lanes rely on the id-derived readiness key, e.g. `shoe-nike-dunk-low-golden-road` -> `shoe_nike_dunk_low_golden_road`.
  - Because of that, exact-ready rows stayed broad or unresolved even when title/description had exact model evidence.

## Decisions / Changes
- Added `skuReadyLaneKey` helper so fashion promotion accepts either explicit `laneKey` or id-derived `LANE_READINESS` ready key.
- Kept broad promotion blocked for broad lanes; the fallback readiness only lets narrow/exact ready lanes win.
- Tightened `shoe-nike-dunk-low-broad` guards for golf, Twist, SB, Powerpuff, Neckface, QuarterSnacks, Atmos, Doernbecher, Harris Tweed, Gore-Tex, NBA, Banana, Premium/SP/QS, and Next Nature.
- Added Travis SB Dunk alias support for `스캇/scott`, while blocking BAPE/Indigo/Chicago/Golden Gals/Metallic Silver contamination.
- Added Racer Blue guard so `Racer Blue University Red` does not collapse into University Blue or University Red.
- Added global fashion alteration noise for `커스터마이징`, `customized`, `custom painted`, `리폼`, `reform`.
- Added regression coverage for Dunk broad pollutants, exact lane promotion, Racer Blue ambiguity, custom, and reform rows.

## DB Mutations Applied
- Applied current-catalog reclassification for existing Dunk broad parsed rows:
  - reason: `wave821_dunk_broad_exact_and_pollution_cleanup`
  - scanned parsed rows: 220
  - candidate rows: 42
  - reclassified rows: 9
  - rejected rows: 33
- Reclassified exact examples:
  - Golden Road, University Blue, LX, Varsity Green, Varsity Maize, Chicago, Light Bone.
- Rejected broad pollutants:
  - SB, golf, Twist, Harris Tweed, Gore-Tex, NBA, Banana, Next Nature, Premium/SP/QS, Atmos, and other non-general axes.
- Applied one unrelated all-category drift found by final cleanup:
  - pid `401339214` tablet SKU drift `ipad-air-4-64-wifi` -> current `ipad-air` option key.
  - reason: `wave821_final_all_category_cleanup_check`.

## Market Refresh
- After Dunk apply:
  - `timedOut=false`
  - `scored=673`
  - `poolUpserted=607`
  - `upserted=80`
  - `market_invalidation_claimed_shoe_keys=2`
- After all-category drift apply:
  - `timedOut=false`
  - `scored=257`
  - `poolUpserted=206`
  - `upserted=38`

## Verification
- Regression:
  - `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 26/26 passed.
- All-category current reparse cleanup dry-run after apply:
  - `scannedPoolRows=522`
  - `candidateRows=0`
  - `invalidatePoolRows=0`
  - `reclassifyRows=0`
  - `rejectRows=0`
- Shoe SKU safety:
  - `catalogSku=633`
  - `nonEmptySku=490`
  - `readySku=72`
  - `safe_public=65`
  - `probably_safe=7`
  - `fix_now=0`

## Deferred / Follow-Up
- Do not release `shoe-nike-dunk-low-broad`; broad remains a watch/internal bucket.
- Next shoe follow-up candidates from safety report:
  - `shoe-newbalance-327-broad`
  - `shoe-gucci-broad`
  - `shoe-converse-chuck70-high-broad`
  - `shoe-adidas-tobacco-broad`
  - `shoe-prada-broad`
- For broad buckets, only promote rows to public when exact model evidence is repeatable and guarded by regression tests.
