# Wave 496 — Market Invalidation Fast Lane

Date: 2026-05-21 KST

## Context

Joongna shoe/clothing listings are being collected and parsed, but ready pool entry is sparse because many comparable keys are waiting for `mvp_market_price_daily` recomputation. The pending `mvp_market_key_invalidation` queue was measured at 2,123 rows, with a large shoe/clothing share.

Follow-up inspection found another source-specific gap: Joongna ingest wrote `mvp_raw_listings`, `mvp_listing_parsed`, and observations, but did not directly enqueue market key invalidations like the Bunjang search/detail pipeline does.

## Decision

Increase market invalidation throughput conservatively and prioritize the new fashion/shoe pressure:

- Default market invalidation claim limit: 200 -> 500.
- Read a wider 3,000-key priority window before selecting claims, paged 1,000 keys at a time.
- Keep DB priority ordering first, then locally boost:
  - Joongna-affected keys.
  - `shoe` and `clothing` comparable key prefixes.
  - `bag` gets a smaller boost.
- Chunk `mvp_market_key_invalidation` completion patches by 100 comparable keys to avoid long PostgREST URLs.
- Add market-worker timing counters for claimed Joongna/shoe/clothing keys.
- Joongna ingest now enqueues `joongna_active_snapshot` market invalidations for parsed, non-review comparable keys.
- Joongna shoe/clothing comparable keys use a higher invalidation priority so market rows are created before lower-pressure categories.

## Why This Way

This avoids loosening pool safety gates. A row still needs enough market evidence and existing candidate-pool checks before it can become ready. The change only helps the market worker clear the key backlog faster and in a more useful order.

## Deferred

- No schema migration was added.
- No hard source-specific queue column was added. `affected_pid` is used to resolve source from `mvp_raw_listings`.
- If market-worker approaches the 90s route ceiling, lower `PIPELINE_MARKET_INVALIDATION_CLAIM_LIMIT` or `PIPELINE_MARKET_INVALIDATION_PRIORITY_WINDOW` via env.
