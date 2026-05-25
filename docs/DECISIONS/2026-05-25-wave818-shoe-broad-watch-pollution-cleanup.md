# Wave 818 Shoe Broad Watch Pollution Cleanup

Date: 2026-05-25

## Context
- Continued shoe deep sweep after CDG Nike exact split.
- Focused on high-volume `watch_internal_only` broad buckets, especially NB 327 and Converse Chuck 70 High.
- These broad buckets are not public-ready, but dirty internal parsed samples can pollute future exact split work and market medians.

## Findings
- `shoe-newbalance-327-broad` sample pollution:
  - Nike Daybreak comparison / multi-brand wording.
  - STAUD collab.
  - Mister Sabotage / sabotage collab.
  - `남아여아` child/common listing wording.
- `shoe-converse-chuck70-high-broad` sample pollution:
  - Coca-Cola collab.
  - Chiara Ferragni collab.
  - Kim Jones collab.
  - Fear of God Essentials collab.
  - Slam Jam collab.
  - Chuck 70 Plus and AT-CX variants.
- `shoe-gucci-broad` remains too wide across sneakers, loafers, mules, sandals, boots, and rain boots. It should stay internal-only until exact Gucci model lanes are split.
- `shoe-adidas-tobacco-broad` looked mostly same-model stable in the sampled rows, but still remains broad/internal-only for now.

## Decisions / Changes
- Tightened NB 327 broad guards:
  - Reject STAUD, Sabotage, Nike Daybreak/multi-brand wording, and child `남아/여아` wording.
- Tightened Converse Chuck 70 High broad guards:
  - Reject Coca-Cola, Chiara Ferragni, Kim Jones, FOG Essentials, Slam Jam, Plus, and AT-CX.
- Added regression coverage that pollutants now return null while ordinary NB 327 and ordinary Chuck 70 High still match their broad SKU.

## DB Mutations Applied
- Rejected 13 stale broad parsed rows by current catalog:
  - `shoe-newbalance-327-broad`: 5 rows.
  - `shoe-converse-chuck70-high-broad`: 8 rows.
  - reason: `wave818_shoe_broad_watch_pollution_cleanup`.
- Market stats refresh after apply:
  - `timedOut=false`
  - `scored=671`
  - `poolUpserted=604`
  - `upserted=59`
  - `market_invalidation_claimed_shoe_keys=3`

## Verification
- Regression:
  - `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 23/23 passed.
- All-category current reparse cleanup dry-run:
  - `scannedPoolRows=522`
  - `candidateRows=0`
  - `invalidatePoolRows=0`
  - `reclassifyRows=0`
  - `rejectRows=0`
- Shoe SKU safety:
  - `readySku=72`
  - `safe_public=65`
  - `probably_safe=7`
  - `fix_now=0`

## Deferred / Follow-Up
- Do not release broad shoe buckets just because they have many eligible rows.
- Next high-ROI exact split candidates:
  - Gucci broad: Princetown, Jordaan/Horsebit loafer, Screener/GG sneaker, slides/sandals, rain boots.
  - Nike Mercurial broad: Vapor 15 Elite FG and similar model/ground splits.
  - Adidas Superstar broad: Superstar 1/2 and Song for the Mute collab separation.
  - Nike Dunk broad: only explicit colorway lanes should release; broad remains internal.
