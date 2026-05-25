# 2026-05-25 Wave 812 Clothing Sample Safety

## Context
- User reported clothing/shoe ready samples showing wrong comparison listings and asked for systematic, category-wide hardening instead of one-token fixes.
- Shoe Wave 811 was already completed; this wave focused on clothing ready rows and their comparable sample groups.
- Initial clothing audits showed active ready/reserved rows were mostly clean, but several sample comparison groups still contained stale broad keys or special variants.

## Decisions
- Held broad or still-unsafe public lanes:
  - `fog_main_jacket`: blocked until 5th/6th/8th, rider, suede, fur/sherpa, denim/trucker/material axes are split.
  - `arcteryx_atom`: blocked generic Atom; exact `Atom LT Hoody`, `Atom LT Jacket`, `Atom SL`, `Atom AR/Heavyweight` remain ready.
  - `alpha_mil_jacket`: blocked broad Alpha MA-1/N2B/M65/leather/stadium lane until model/material split.
  - `bape_tee`: blocked broad BAPE tee after A/B grade samples still mixed basic, college, milo, camo, ladies, and limited tees.
- Kept narrower lanes ready but tightened deterministic blockers:
  - Polo Pony Tee now rejects BAPE/shark, PK/pique wording, boys/girls/junior, and other-brand polo-knit leak terms.
  - Polo Pique recognizes `PK반팔` variants.
  - Polo Knit rejects Adidas/CLOT, Marni/third-party polo-knit brands, boys/girls, bear, Chaps, Lauren RL, Brooks Brothers, etc.
  - Stussy direct hoodie shortcut no longer bypasses catalog blockers for 8ball, pigment, CPFM, DSM/Dover, Our Legacy, Martine Rose, Futura, Stock Seoul, Dice, Stars, and Double Face axes.
  - Stussy hoodie/zip hoodie now blocks special axes instead of letting them pollute basic hoodie/zip comparisons.
  - FOG Essentials Hoodie now blocks zip hoodie terms.
  - FOG Main tee/hoodie no longer absorbs jacket/material text from descriptions.
  - Patagonia Retro X / Deep Pile stale sample rows were cleaned by current-catalog reclass/reject.
- Fixed audit-script false positives for `부츠컷` denim and styling descriptions mentioning sneakers/loafers/boots.

## DB Backfill
- Wave 812 sample cleanup A:
  - scanned 407 sample rows.
  - changed 64 rows: reclassified 6, refreshed 15 parsed keys, rejected 43.
  - gate cleanup then invalidated 2 remaining active rows: `arcteryx_atom`, `alpha_mil_jacket`.
- Wave 812 sample cleanup B:
  - scanned 420 sample rows.
  - changed 60 rows: reclassified 34, refreshed 1 parsed key, rejected 25.
  - gate cleanup invalidated 4 active `bape_tee` rows after lane block.
- Wave 812 sample cleanup C:
  - scanned 213 sample rows.
  - changed 43 rows: reclassified 26, refreshed 8 parsed keys, rejected 9.
- Pipeline refresh after DB changes:
  - market/score passes were run after each cleanup phase.
  - final score pass: scored 684, pool upserted 30, timedOut=false.
  - `loadFraudGroupHashes` timed out non-fatally during score passes; score stage completed.

## Verification
- Targeted tests passed:
  - `npx tsx --test tests/fashion-catalog-regression.test.ts`
- Final clothing pool reports:
  - `reports/clothing-pool-purity-latest.json`: activeClothingPoolRows=129, blockedAfterCurrentGate=0, actionableAllowedRows=0.
  - `reports/fashion-pool-purity-latest.json`: activeFashionPoolRows=129, gateBlockedRows=0, actionableRows=0.
  - `reports/fashion-ready-pool-systemic-audit-latest.json`: activePoolRows=129, rowActionableRows=0, groupActionableGroups=3.

## Deferred
- Remaining systemic sample groups are not current active-row blockers, but still show broad sample spread:
  - `patagonia_retro_x` has stale Retro File rows in historical sample material.
  - `polo_knit_sweater` still needs future split between basic cable/crew/v-neck, half-zip/zip knit, cardigan, Fair Isle/Bear/premium variants.
- BAPE tee should be re-promoted only after narrower lanes are added, for example basic Ape Head/College, Milo, Camo, ladies/crop, and limited/store variants.
- A general clothing SKU safety report, analogous to shoe Wave 811, should be added so this can be repeated without ad hoc jq inspection.
