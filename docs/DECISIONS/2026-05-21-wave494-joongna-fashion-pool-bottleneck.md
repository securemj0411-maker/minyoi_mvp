# Wave 494 — Joongna Fashion/Shoe Pool Bottleneck Diagnosis

Date: 2026-05-21 KST

## Context

User reported that Joongna ready pool visually contains almost no shoe/clothing rows and asked whether this is just slow tick cadence or already diagnosable.

## Findings

- Joongna ingest is active and healthy.
- Recent Joongna worker runs fetch about 80 details per run and source health reports `active_ingest_ok`.
- Joongna query pool already contains fashion:
  - `readyCatalogCategoryPoolCounts.shoe = 217`
  - `readyCatalogCategoryPoolCounts.clothing = 43`
  - selected per run is category-balanced at roughly 4 shoe and 4 clothing queries.
- Latest 1,000 active Joongna raw rows already include:
  - raw SKU shoe: 117
  - raw SKU clothing: 29
  - parsed shoe: 129
  - parsed clothing: 32
- Candidate pool for those active Joongna rows is the bottleneck:
  - pool rows: 49
  - ready rows: 47
  - ready clothing: 1
  - ready shoe: 0 in the inspected active Joongna window.
- Fashion/shoe pipeline split:
  - fashion raw/parsed rows inspected: 161
  - scored rows: 147
  - pool rows: 1
  - dominant score flags: `market_stat_missing`, `market_confidence_low`, `condition_review`.
- Market invalidation queue is backed up:
  - pending `mvp_market_key_invalidation`: 2,123
  - first 1,000 pending keys include 573 shoe and 196 clothing.
  - market-worker currently claims only 200 pending keys per run, so fashion/shoe recomputation can lag even though ingest and parse are already producing rows.

## Decision

This is not primarily a "wait for Joongna tick to discover fashion" issue. Joongna is already collecting and parsing shoe/clothing. The visible ready scarcity is primarily a market-price recomputation / pool-entry bottleneck:

1. Many per-size/per-condition fashion comparable keys have no usable `mvp_market_price_daily` row yet.
2. Some rows have a median but are not profitable after fees or are blocked by confidence/safety gates.
3. Pending market invalidations are too backlogged relative to the new Joongna/fashion key volume.

## Deferred / Next Work

- Consider raising or making configurable the pending market invalidation claim limit in `loadPendingMarketInvalidations` from 200 to a higher value, with timing safeguards.
- Consider category/source-aware market invalidation prioritization so Joongna shoe/clothing keys do not wait behind unrelated lifecycle invalidations.
- Do not loosen pool safety gates blindly. Missing/low-confidence market stats should remain a block until enough samples or a deliberate fallback policy is designed.
