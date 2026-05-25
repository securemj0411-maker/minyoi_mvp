# Wave 816 Clothing Ready Sample Spread Cleanup

Date: 2026-05-25

## Context
- User asked to run the same safety style on clothing after shoe cleanup.
- The first clothing SKU safety report had `fix_now=0`, but a deeper ready sample-group audit still showed many high-spread groups.
- Most high spread was normal intra-SKU price variance, but a few groups contained clear product-type pollution.

## Findings
- Clothing ready sample-group audit:
  - `activePoolRows=139`
  - `comparableGroups=71`
  - Initial `groupActionableGroups=0`, but manual review of high-spread groups found hidden same-SKU pollution.
- Clear pollutants:
  - `clothing|polo_pants_chino|pants|b_grade` contained Polo caps, chino jackets, and chino half-pants.
  - `clothing|adidas_trefoil|jacket|b_grade` contained tee/tank/short-sleeve top rows.
  - `clothing|acne_knit|knit|b_grade` contained multi-brand listing bait (`yan13`, Oilily, Lanvin, G-Cut, Acne, Duel, Zara).

## Decisions / Changes
- Tightened `clothing-polo-pants-chino`:
  - Reject cap/hat wording.
  - Reject jacket wording.
  - Reject shorts/half-pants wording.
- Tightened `clothing-adidas-trefoil`:
  - Reject tee/tank/sleeveless wording so those rows do not pollute the jacket/track-top comparable key.
- Tightened `clothing-acne-knit`:
  - Reject multi-brand bait terms such as `yan13`, Oilily, Duel, Zara, G-Cut, and Lanvin.
  - Applied both catalog-level and Acne override-level guards.
- Added regression coverage for the above while preserving valid Polo chino, Adidas track-top, and Acne knit matches.

## DB Mutations Applied
- First clothing cleanup batch:
  - 7 parsed rows processed.
  - 3 reclassified to current non-public broad lanes.
  - 4 rejected by current catalog.
  - Reason: `wave816_clothing_sample_spread_pollution_cleanup`.
- Residual Polo chino cleanup:
  - 4 additional stale parsed rows reclassified away from `clothing-polo-pants-chino`.
  - Reason: `wave816_polo_chino_residual_sample_cleanup`.
- Market/score refresh:
  - Market stage ran after each cleanup batch.
  - Latest market stage: `timedOut=false`, `market_invalidation_claimed_keys=34`, `market_invalidation_claimed_clothing_keys=24`, `poolUpserted=731`.
  - One score stage after the larger clothing batch timed out after committing partial work (`timedOut=true`), but final cleanup checks used the current DB state.

## Verification
- Regression:
  - `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 21/21 passed.
- Clothing ready sample-group audit after residual cleanup:
  - `activePoolRows=140`
  - `rowActionableRows=0`
  - `groupActionableGroups=0`
- Clothing SKU safety:
  - `readySku=47`
  - `safe_public=35`
  - `probably_safe=12`
  - `fix_now=0`
- All-category current reparse cleanup dry-run:
  - `scannedPoolRows=522`
  - `candidateRows=0`
  - `invalidatePoolRows=0`
  - `reclassifyRows=0`
  - `rejectRows=0`
- Funnel snapshot:
  - `rawRows=86576`
  - `parsedRows=115435`
  - `poolRows=6530`
  - ready counts included shoe `139`, clothing `140`, smartphone `38`, tablet `35`, earphone `70`, smartwatch `31`.

## Deferred / Follow-Up
- High spread remains in some clothing groups such as Thom Browne knit, Stussy Nike tee, Adidas trefoil pants, Polo knit, and Stussy hoodie.
- Those are not currently actionable by mixed current SKU or brand conflict, but they should be reviewed in later waves for exact sub-line splits when repeatable model axes appear.
- Broad clothing SKUs remain with `ready=0` in the safety report and should stay watch/internal-only until exact evidence is strong enough.
