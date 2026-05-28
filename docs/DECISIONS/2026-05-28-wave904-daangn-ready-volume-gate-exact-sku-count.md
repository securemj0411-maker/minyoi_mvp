# Wave 904 — Daangn ready volume gate: exact batch SKU counts

Date: 2026-05-28

## Trigger

User questioned why Daangn ready entry was still slow and called out `profit_below_pack_band` as a possibly stale band constraint.

## Findings

- `profit_below_pack_band` was a stale name, not the old pack-band threshold.
  - Wave 885 already lowered `bandFromProfit` entry threshold to `1원`.
  - In the latest Daangn 24h invalidations it accounted for only 2 rows.
- Main Daangn pool rejections were:
  - `daangn_volume_below_3`: 128 rows
  - `sku_low_volume_below_2d1_or_7d3`: 46 rows
- Spot check showed many `daangn_volume_below_3` rows had enough Daangn SKU samples when counted directly.
- Root cause: `loadDaangnVolumeBySku` scanned the newest global 10K Daangn rows, so a SKU currently being scored could be outside that window and be under-counted as `<3`.
- Similar window under-counting existed in the general low-volume SKU helper because it sampled a capped global newest window.

## Decision

Do not loosen the safety threshold blindly. First remove the counting error.

Updated score-stage preload helpers:

- `loadDaangnVolumeBySku(targetSkuIds)` now counts only the SKU IDs present in the current score batch.
- `loadLowVolumeSkuIds(targetSkuIds)` now counts only the relevant shoe/clothing/bag SKU IDs present in the current score batch.
- Fallback no-argument behavior remains for compatibility.
- Added `daangn_volume_below_3` and `sku_low_volume_below_2d1_or_7d3` to the recoverable invalidation whitelist so rows falsely blocked by the old window can be re-scored.

Expected effect:

- Reduce false `daangn_volume_below_3` and low-volume invalidations.
- Increase Daangn ready throughput without admitting rows that truly have no market support.
- Reduce wasted global scans during score-worker runs.

## Deferred

- New invalidations should use `profit_not_positive_after_costs`; legacy `profit_below_pack_band` rows remain readable/recoverable for compatibility.
- Reaching ~1000 Daangn ready/day likely requires a separate, explicitly labeled strategy: "buy on Daangn, resell on Bunjang/Joongna." Do not silently use mixed market basis as if it were Daangn 시세.

## Verification

- `npx tsx --test tests/wave249-pool-builder-clamp-fix.test.ts tests/daangn-market-basis-contract.test.ts tests/daangn-profit-copy-contract.test.ts` passed.
- `npx eslint src/lib/tick-pipeline.ts src/lib/candidate-pool-builder.ts tests/wave249-pool-builder-clamp-fix.test.ts` passed with pre-existing warnings only:
  - `trimmedSellerMarket` unused
  - `MARKET_INVALIDATION_FAST_LANE_PREFIXES` unused
- `npm run build` could not start because another Next build lock was active.
- `npx tsc --noEmit --pretty false` still fails on pre-existing test type issues unrelated to this wave.
