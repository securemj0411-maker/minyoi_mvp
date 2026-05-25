# Wave 881 Current Replay Drain - Y-3 QASA / NB327

## Context
- User asked to continue systematic deepsweep without stopping, especially shoes/clothing sample pollution and stale parser drift.
- Latest 1,000 fashion/current replay still had actionable rows after the previous shoe/clothing cleanups.

## Decisions
- Treat Y-3 QASA rows as shoe, not Adidas x Y-3 apparel:
  - Added Y-3 apparel must-not model blockers for QASA/Kaiwa/Adios/Takumi/Pureboost/4D/ZG shoe terms.
  - Expanded Y-3 QASA shoe matching to Korean user expressions (`와이쓰리`, `요지야마모토`, `콰사 하이`) so new raw rows route to the shoe SKU.
- Treat NB327 `뉴발란스 327 올림픽` as stale parsed condition only:
  - Current parser already reads `미착용 새제품 박스풀` as `A`; DB row still had old `c_grade/UNKNOWN`.
  - Backfilled only that stale pid instead of adding new catalog logic.

## Applied
- Backfilled parsed/raw rows:
  - `282211589`: `shoe|y3_qasa_broad|sneaker|b_grade`
  - `398751123`: `shoe|y3_qasa_broad|sneaker|c_grade`
  - `172619812`: `shoe|newbalance_327_broad|sneaker|a_grade`
- Enqueued market invalidations for old and new comparable keys.
- Ran `marketStatsStage` once:
  - queued/enriched 92 keys, scored 3,169 market rows, upserted 477 keys, sample count 3,380.
- Ran `scoreStage` with extended deadline after the 60s force script timed out before scoring:
  - scored 278 rows, upserted 186 score rows, pool upserted 28, timedOut false.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 79/79 passed.
- `report-cross-category-db-deep-sweep --limit=1000 --focus=fashion-current`
  - Before Y-3 fix: actionableRows 2.
  - After Y-3 fix: actionableRows 1 (NB327 stale condition).
  - After NB327 backfill: actionableRows 0, poolActionableRows 0.

## Deferred / Watch
- Current 1,000 replay still has non-actionable spread groups (e.g. Stussy World Tour tee, Polo/PXG polo wording, Moncler broad, Converse One Star broad), but no ready/reserved actionable rows in this slice.
- Next sweep should widen beyond latest 1,000 and prioritize groups where `mixed_raw_sku` plus high spread intersects active/ready pool rows.
