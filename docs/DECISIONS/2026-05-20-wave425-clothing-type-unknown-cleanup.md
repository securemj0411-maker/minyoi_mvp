# 2026-05-20 Wave 425 - Clothing Type Unknown Cleanup

## Decision
- Continue the conservative fashion cleanup by closing parser holes that leave broad clothing rows in `type_unknown`.
- Do not open new ready lanes in this wave; only improve product-type separation inside already-matched fashion SKUs.
- Bump clothing parser version to `wave216-clothing-v13` because comparable keys change for previously unknown rows.

## Parser Changes
- Map cropped/top variants to `tee`:
  - `크롭탑`, `crop top`
  - `볼레로`, `bolero`
  - `캐미솔`, `camisole`
  - `나시 탑`, `나시`
- Map bare Korean market shorthand `스웻` to `crewneck`.
- Map straight denim variants to `jeans`:
  - `스트레이트 데님`
  - `스트레이드 데님`

## DB Actions
- Backfilled the targeted 702-row scope:
  - 691 clothing rows -> `wave216-clothing-v13`
  - 11 bag rows -> `wave92-bag-v11`
  - post-backfill `typeUnknownCount=0`
- Upserted the 18 follow-up dirty rows that scoreStage surfaced from adjacent fashion lanes, then drained score dirty with AI disabled.

## Verification
- Tests:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - result: 155 pass / 0 fail
- Dirty queue after score drain:
  - loadedDirtyFashionRows: 0
  - rawCurrentMismatchRows: 0
  - parsedKeyDriftRows: 0
  - parserNeedsReviewRows: 0
- Pool purity after score drain:
  - activeFashionPoolRows: 57
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
  - dbProductTypeUnknown: 0

## Deferred
- The targeted sweep still reports 25 flagged comparable groups driven mostly by broad-lane price spread/category-term heuristics. They are not topFlags and are not pool-exposed; handle later with lane-specific review rather than broad parser expansion.
- `nullSkuWouldMatchNow` and `nullSkuFashionCoverageHoles` remain observation-only. Do not bulk promote null-SKU fashion rows without a capped review pass.
