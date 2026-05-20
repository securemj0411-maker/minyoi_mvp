# 2026-05-20 Wave 424 - Fashion Parser DB Tightening

## Decision
- Keep the fashion/shoe/bag rollout conservative: reduce ready exposure by fixing parser/catalog drift before adding new broad lanes.
- Align DB sweep expectations with current runtime parser versions:
  - shoe: `wave92-shoe-v11`
  - clothing: `wave216-clothing-v12`
  - bag: `wave92-bag-v11`
- Treat clothing product-type separation as a hard safety boundary:
  - `후드티셔츠` now parses as `hoodie`, not `tee`.
  - Polo glued/spacing Oxford variants (`옥스포드셔츠`, `옥스포드`) route to `clothing-polo-oxford-shirt`, not broad Polo apparel.
  - Accessory-only paper shopping bags are blocked from clothing broad while normal "shopping bag included" full-set clothing remains allowed.
- Apply the same title-first product-type policy to bags:
  - Title `토트백/크로스백/숄더백` wins over description inventory text like `지갑`, `파우치`, `숄더/크로스 연출`.
  - `bag` parser bumped to `wave92-bag-v11` because comparable keys can change.
- Keep Maison Margiela 5AC out of Margiela broad fallback:
  - Glued notation such as `5ac크로스백`, `5ac미니백` now matches `bag-margiela-5ac-mini`.
  - Margiela broad explicitly excludes glued 5AC variants.

## DB Actions
- Nullified one accessory-only row from live fashion matching:
  - `pid=409254538` (`톰브라운 쇼핑백 미사용 ...용`) -> `sku_id=null`, `pool_eligible=false`, `score_dirty=false`.
- Backfilled target clothing/bag parser rows after catalog/parser tightening:
  - target rows: 712
  - parsed upserts: 646
  - affected lanes: Champion, Carhartt, Thom Browne, CDG clothing broad, and one Thom Browne bag row.
- Reclassified stale BAPE rows that had been stored as tee:
  - `pid=384251761`, `407966767`: `clothing-bape-tee` -> `clothing-bape-hoodie`
  - `pid=409111510`: `clothing-bape-tee` -> `clothing-bape-hoodie-zip`
- Backfilled Maison Margiela 5AC rows to `wave92-bag-v11`:
  - fetched/upserted: 11
  - fixed `pid=383694933` from wallet-contaminated key to `bag|5ac_mini|tote|era_unknown|unknown_size_variant`
  - fixed `pid=408451236` so current catalog remains `bag-margiela-5ac-mini`, not Margiela broad.

## Verification
- Tests:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - result: 151 pass / 0 fail
- Dirty queue after score drain:
  - loadedDirtyFashionRows: 0
  - currentSkuNullRows: 0
  - rawCurrentMismatchRows: 0
  - parsedKeyDriftRows: 0
  - parserNeedsReviewRows: 0
- Pool purity after score drain:
  - activeFashionPoolRows: 56
  - gateBlockedRows: 0
  - flaggedRows: 0
  - actionableRows: 0
- Targeted sweep after backfill:
  - rawSkuRejectedByCurrentCatalog: 0
  - rawSkuDiffersFromCurrentCatalog: 0
  - dbCleanButCurrentCatalogRejects: 0
  - dbCleanButCurrentCatalogChangesKey: 0
  - parsedStaleVersion: 0
  - poolExposedWithDrift: 0
  - remaining dbProductTypeUnknown: 5

## Deferred
- Remaining `dbProductTypeUnknown=5` in the targeted sweep are not pool-exposed; handle in a later narrow wave instead of broadening runtime behavior.
- BAPE/Stussy basic apparel lanes remain intentionally blocked until sample quality is strong enough for safe ready exposure.
- Size-specific turnover/rate grouping is deferred from this wave; the current work only tightens matching and parser cleanliness.
