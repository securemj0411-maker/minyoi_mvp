# 2026-05-20 Wave 405 - Fashion/Shoe DB Sweep

## Decision
- Ran a read-only DB sweep focused on fashion raw SKU drift, parser-version drift, product-type unknowns, and comparable-key contamination.
- Treat `mvp_raw_listings.sku_id` drift as the first-class risk because market sample reparsing currently trusts stored raw SKU IDs.

## Findings Snapshot
- raw SKU rejected by current catalog: 0
- raw SKU differs from current catalog: 0
- DB-clean rows that current catalog rejects: 0
- pool exposed with catalog/parser drift: 0
- flagged comparable groups: 25
- null SKU rows that would match current catalog now: 61

## Deferred
- No DB mutation in this wave. If confirmed, next step is a no-write reclassification plan for stale fashion `sku_id` rows, then a capped apply/backfill.
- Catalog/parser patches should be driven by the top flagged samples rather than broad hand edits.

## Artifacts
- `reports/fashion-shoe-db-sweep-targeted-latest.json`
- `reports/fashion-shoe-db-sweep-targeted-latest.md`
