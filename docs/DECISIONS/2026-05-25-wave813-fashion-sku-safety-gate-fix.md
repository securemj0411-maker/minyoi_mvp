# Wave 813 Fashion SKU Safety + Shoe Gate Fix

Date: 2026-05-25

## Context
- User asked to continue the shoe/clothing sample-safety work, then run the same style of SKU safety audit for clothing.
- During clothing cleanup, the remaining actionable sample groups were reduced to zero, but a broader SKU-safety report found hidden broad-to-narrow drift.
- A later gate cleanup exposed a real shoe inflow bug: the `shoe` category is `internal_only`, but some exact shoe SKUs did not pass `LANE_READINESS` because their catalog rows lacked `laneKey` or their lane key was missing from readiness.

## Decisions / Changes
- Generalized `scripts/report-shoe-sku-safety.ts` with `--category=shoe|clothing` and category-aware false-positive handling.
- Fixed stale parsed cleanup in `scripts/apply-fashion-current-catalog-reclassify.ts` so rows with `raw.sku_id=null` and `current=null` still clear stale `comparable_key`.
- Added/verified catalog rules:
  - `Marni/마르니` no longer routes to Polo Ralph Lauren knit.
  - Supreme x Nike Air Max shoe lane rejects cap/accessory wording.
  - Acne truncated `JACKE` routes to Acne jacket/coat.
- Reclassified DB sample/current drift:
  - Clothing: 56 candidates, 55 reclassified, 1 parsed refresh.
  - Shoe: Supreme/Nike Air Max cap sample rejected; 2 valid shoe rows refreshed.
  - Patagonia Retro X stale parsed sample rows rejected.
- Fixed shoe lane gating:
  - `evaluateLaneReadinessForSku` now falls back from `sku.laneKey` to normalized SKU id (`shoe_nike_airjordan_1_mid`, etc.).
  - Added ready lane entries for exact high-end shoe lanes: `lv_trainer`, `lv_runaway`, `hermes_izmir`, `dior_b23`, `dior_b27`, `dior_b30`, `shoe_nike_pegasus_turbo`, `shoe_converse_chuck70_cdg_play_white`, `shoe_newbalance_550_white_green`.
- Recovered only the safe exact shoe rows that were accidentally invalidated by the old gate:
  - 32 checked, 29 restored.
  - 3 were not restored because current scoring skipped them (`negative_resell_gap`, `seller_above_1_listings`, `sku_low_volume_below_2d1_or_7d3`).
  - `asics_kiko_collab` broad remained blocked intentionally.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 18/18 passed.
- `npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --categories=shoe,clothing --statuses=ready,reserved --include-key-drift`
  - dry-run `candidateRows=0`.
- `npx tsx scripts/report-fashion-pool-purity.ts --categories=shoe,clothing --statuses=ready,reserved`
  - `activeFashionPoolRows=276`
  - `shoe=140`, `clothing=136`
  - `gateBlockedRows=0`
  - `actionableRows=0`
- SKU safety:
  - shoe ready grades: `safe_public=65`, `probably_safe=4`, `fix_now=0`
  - clothing ready grades: `safe_public=33`, `probably_safe=13`, `fix_now=0`
- Overall pool count after recovery/pipeline:
  - `ready=524`, `reserved=0`, `spent=21`, `invalidated=5935`
- Pipeline:
  - market stage: `scored=617`, `poolUpserted=537`, `timedOut=false`
  - score stage: `scored=434`, `poolUpserted=53`, `timedOut=true`; non-fatal fraud hash timeout, partial work committed.

## Deferred / Follow-Up
- Full all-category deep sweep is still pending; this wave focused on shoe/clothing SKU safety and gate correctness.
- Clothing `watch_internal_only` broad lanes remain intentionally not public-ready until split or enough exact SKU evidence exists.
- Shoe broad lanes remain blocked by `category_internal_only_shoe_broad_lane_required`; exact lanes must pass lane readiness.
