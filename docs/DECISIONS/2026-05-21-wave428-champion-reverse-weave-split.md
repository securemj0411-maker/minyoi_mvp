# 2026-05-21 Wave 428 — Champion Reverse Weave + Carhartt pants split

## Decisions
- Split `Champion Reverse Weave` out of generic Champion apparel broad into `clothing-champion-reverse-weave`.
- Kept generic Champion rows in `clothing-champion-apparel-broad`; broad now rejects `reverse weave`, `reverseweave`, `리버스위브`, and `리버스 위브` so the two lanes do not collide.
- Kept Champion collab / limited lines out of generic Champion broad until there are enough safe samples for their own lanes:
  - `glowny` / `글로니`
  - `thisisneverthat` / `디스이즈네버댓` / `디네댓`
  - `fuct` / `퍽트`
- Added Korean `스웨트셔츠` / `스웨트셔트` handling to the clothing product-type parser so sweatshirts do not fall through to generic `shirt`.
- Moved `blouse` / `블라우스` from tee-like parsing to shirt-like parsing so designer blouses do not contaminate tee comparable groups.
- Added `폴로셔츠` / `폴로 셔츠` to polo-shirt parsing so polo shirts do not stay in generic shirt comparable groups.
- Moved `니트 긴팔 티셔츠`-style rows to `long_sleeve_tee` before generic knit/sweater parsing, so thin knit tees do not enter Thom Browne knit comparable groups.
- Added `숏팬츠` / `short pants` to shorts parsing before generic pants parsing, so shorts do not remain in pants comparable groups.
- Split repeated CDG sub-lines out of generic Comme des Garcons broad:
  - `clothing-cdg-homme-apparel-broad`
  - `clothing-cdg-homme-plus-apparel-broad`
- Split repeated Carhartt pants lanes out of generic Carhartt apparel broad:
  - `clothing-carhartt-double-knee-pants`
  - `clothing-carhartt-cargo-pants`
- Split repeated Carhartt WIP/vintage model lines out of generic Carhartt broad:
  - `clothing-carhartt-santa-fe-jacket`
  - `clothing-carhartt-madison-apparel-broad`
  - `clothing-carhartt-landon-pants`
  - `clothing-carhartt-chase-sweatpants`

## DB writes
- Reclassified 32 recent Champion broad rows into `clothing-champion-reverse-weave`.
- Reclassified 23 recent Carhartt broad rows into double-knee/cargo lanes.
- Reclassified 2 recent CDG broad rows from tee to shirt after the blouse parser fix.
- Reclassified 3 recent CDG/Thom Browne rows from shirt to polo_shirt after the polo-shirt parser fix.
- Reclassified 1 recent Thom Browne row from `knit` to `long_sleeve_tee` after the `니트 긴팔 티셔츠` parser fix.
- Cleared 9 recent Champion broad collab/limited rows to `sku_id=null` (`글로니`, `디스이즈네버댓`, `FUCT`) so they do not pollute generic Champion samples.
- Reclassified 24 recent CDG broad rows into Homme / Homme Plus lanes.
- Reclassified 15 recent Carhartt broad rows into Santa Fe / Madison / Landon / Chase lanes.
- Reparsed 4 recent `숏팬츠` rows (1 Carhartt, 3 Adidas) from pants-like comparable keys into shorts comparable keys.
- Re-synced targeted Carhartt/CDG/Champion/Thom Browne parsed rows with current clothing parser v13.
- Used per-pid PATCH with `Prefer: return=representation` and verified returned `parser_version` / `comparable_key` for residual rows.

## Verification
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 171 pass, 0 fail.
- Targeted fashion sweep after DB sync:
  - rawSkuRejectedByCurrentCatalog: 0
  - rawSkuDiffersFromCurrentCatalog: 0
  - dbCleanButCurrentCatalogRejects: 0
  - dbCleanButCurrentCatalogChangesKey: 0
  - parsedStaleVersion: 0
  - poolExposedWithDrift: 0
  - dbProductTypeUnknown: 0
  - flaggedComparableGroups: 16
- Carhartt pants unknown group dropped from 24 rows to 15 rows after moving double-knee/cargo rows.
- Thom Browne knit `c_grade` spread dropped from 25.2 to 3.0 after moving a low-price `니트 긴팔 티셔츠` row out of knit.
- Flagged groups dropped 23 → 21 after Champion collab cleanup, 21 → 19 after CDG Homme split, and 19 → 16 after Carhartt model-lane split.

## Deferred
- Carhartt broad still mixes Marshall/simple/work/vintage rows; split only with repeated exact tokens and enough samples.
- CDG broad and CDG PLAY tee groups still have price spread; avoid color/heart-style over-splitting until repeated line-level tokens are verified.
- Thom Browne remains broad by garment type; split material/line only if it repeatedly improves comparable density without creating thin lanes.
- Size/rotation-rate bucketing remains deferred to a separate wave.
