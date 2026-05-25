# Wave 824 Yeezy 350 Broad Pause And Order-Style Cleanup

Date: 2026-05-25

## Context
- Continued shoe `probably_safe` cleanup after BAPE STA.
- `shoe-yeezy-boost-350` remained public-ready with operator feedback showing high price spread and sample uncertainty.
- Live raw rows showed broad Yeezy 350 was mixing many colorways plus order-style / multi-size rows.

## Findings
- Legacy `shoe-yeezy-boost-350` was too broad:
  - V1/V2 and many colorways were in one public lane.
  - Examples included Cream White, Butter, Black Non-Reflective, Beluga, Blue Tint, Frozen Yellow, Mono Clay, Granite, Tail Light, Static, etc.
  - Some rows looked like multi-size order / dropship rows: `주문방법`, `요청사항`, `주문가능사이즈`, `색상/사이즈`, `해외발송`.
- Existing exact Yeezy 350 entries are duplicated across generated catalogs and currently do not produce stable exact public matches; this needs a separate exact-split repair.

## Decisions / Changes
- Changed public readiness:
  - `yeezy_boost_350`: `ready` -> `internal_only`.
  - `yeezy_350_broad`: `ready` -> `internal_only`.
- Added order-style / dropship guards to:
  - legacy `shoe-yeezy-boost-350`.
  - generated `shoe-adidas-yeezy-350-broad`.
  - generated `shoe-yeezy-boost-350-v2-broad`.
- Added `defaultProductType: "sneaker"` to legacy Yeezy 350.
- Added regression coverage:
  - order-style rows reject;
  - generic Yeezy 350 broad rows do not enter public matching until exact split is repaired.

## DB Mutations Applied
- Applied current-catalog reclassification for legacy `boost_350` comparable keys:
  - reason: `wave824_yeezy_350_broad_pause_and_order_cleanup`
  - scanned parsed rows: 112
  - candidate rows: 112
  - rejected rows: 112
  - reclassified rows: 0

## Market Refresh
- `timedOut=false`
- `scored=672`
- `poolUpserted=600`
- `upserted=100`
- `market_invalidation_claimed_shoe_keys=4`

## Verification
- Regression:
  - `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 29/29 passed.
- All-category current reparse cleanup dry-run after apply:
  - `scannedPoolRows=516`
  - `candidateRows=0`
  - `invalidatePoolRows=0`
  - `reclassifyRows=0`
  - `rejectRows=0`
- Shoe SKU safety:
  - `catalogSku=633`
  - `nonEmptySku=490`
  - `readySku=69`
  - `safe_public=65`
  - `probably_safe=4`
  - `fix_now=0`

## Deferred / Follow-Up
- Rebuild Yeezy 350 only as exact lanes after duplicate catalog entries are resolved.
- Candidate exact split axes:
  - Zebra / Bred / Beluga / Onyx
  - Cream White / Triple White
  - Black Non-Reflective / Black Reflective
  - Butter / Blue Tint / Frozen Yellow / Granite / Mono Clay / Tail Light / Static
- Do not re-release a catch-all Yeezy 350 public lane.
