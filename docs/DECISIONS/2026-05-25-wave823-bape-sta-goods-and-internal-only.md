# Wave 823 BAPE STA Goods Cleanup And Public Lane Pause

Date: 2026-05-25

## Context
- Continued shoe `probably_safe` cleanup after Gucci Rhyton was moved to internal-only.
- `shoe-bape-sta` had operator feedback showing sample pollution from BAPE/Starbucks goods, apparel/accessories, and non-comparable variants.
- Live raw rows still had stale `sku_id=shoe-bape-sta` on goods/accessories.

## Findings
- Root cause:
  - BAPE STA required one phrase token, but Korean `베이프 스타` also appears inside `베이프 스타벅스`.
  - `shoe-bape-sta` did not have `defaultProductType`, so unrelated description words could produce noisy product-type keys.
- Stale pollutants found:
  - Baby Milo / Bapesta figure.
  - BAPE Starbucks neck pillow / cushion.
  - Starbucks coaster.
  - Baby Milo mug set.
  - Bapesta hairpin.
  - Converse camo-logo row.
  - Juice WRLD custom row.

## Decisions / Changes
- Added BAPE STA guards for:
  - Starbucks / 스벅
  - Baby Milo / Milo
  - figure / toy / 피규어
  - mug / coaster
  - neck pillow / cushion
  - hairpin / 머리핀
  - Converse
  - custom / 커스텀
- Added `defaultProductType: "sneaker"` to BAPE STA.
- Changed `bape_sta` lane readiness from `ready` to `internal_only`.
- Added regression coverage that:
  - goods/accessory/custom rows reject;
  - real `BAPE Bapesta` still matches the SKU;
  - pool gate blocks it while internal-only.

## DB Mutations Applied
- Applied current-catalog reclassification for BAPE STA comparable keys:
  - reason: `wave823_bape_sta_goods_and_internal_only_cleanup`
  - scanned parsed rows: 54
  - candidate rows: 8
  - rejected rows: 8
- Rejected pids:
  - `400034068` Bapesta Converse camo-logo
  - `359874047` Bapesta Juice WRLD custom
  - `358807610` Milo coaster / Starbucks
  - `407519047` Bapesta hairpin
  - `408709647` Starbucks Baby Milo mug set
  - `409077748` Starbucks coaster
  - `409252668` Starbucks neck pillow / cushion
  - `409532521` Baby Milo Bapesta figure
- Applied internal-only gate cleanup:
  - reason: `wave823_bape_sta_internal_only_gate`
  - invalidated pool rows: 2
  - affected public ready rows:
    - `389615769` Gucci Rhyton, still present as ready and re-blocked by gate.
    - `7003451747584` BAPE STA.

## Market Refresh
- `timedOut=false`
- `scored=679`
- `poolUpserted=620`
- `upserted=99`
- `market_invalidation_claimed_shoe_keys=5`

## Verification
- Regression:
  - `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 28/28 passed.
- All-category current reparse cleanup dry-run after apply:
  - `scannedPoolRows=520`
  - `candidateRows=0`
  - `invalidatePoolRows=0`
  - `reclassifyRows=0`
  - `rejectRows=0`
- Shoe SKU safety:
  - `catalogSku=633`
  - `nonEmptySku=490`
  - `readySku=70`
  - `safe_public=65`
  - `probably_safe=5`
  - `fix_now=0`

## Deferred / Follow-Up
- Do not release broad BAPE STA until exact variant split is sample-supported.
- Possible future split axes:
  - BAPE STA #2 / #3 / #4 / #7
  - OS / M1 / M2
  - USPS / Medicom Toy / other collabs
  - High / 93 High
