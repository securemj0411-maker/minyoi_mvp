# 2026-06-02 wave1007 - Admin pool list/stats split

## Context

The operator pool page under `/cauleexxy.../pool` felt slow even though the visible page only shows about 20 rows.

Code inspection showed the visible list and the expensive stats/filter metadata were bundled into the same `/api/admin/pool-listings` response on page 1.

The page 1 stats work includes:

- 9 exact count queries for `profit_band × status`.
- Fetching all ready pool pids up to 20,000 rows.
- Chunk joins against `mvp_raw_listings` and `mvp_listings` to build source, SKU, price bucket, category, and Daangn region stats.
- Per-page enrichment also joins listings/raw/parsed/analysis/feedback/market bands.

So the page was not merely fetching 20 listing cards; it was also waiting for full-pool stats.

## Decision

Do not remove operator stats, but stop stats from blocking the list.

- Add `includeStats` to `/api/admin/pool-listings`.
- Admin pool card list requests now pass `includeStats=0`.
- Stats are fetched in a separate background request with `includeStats=1`.
- Refresh triggers both list and stats refresh, but the visible list can render first.

## Implementation

Changed:

- `src/app/api/admin/pool-listings/route.ts`
- `src/components/admin-pool-browser.tsx`

No DB/schema changes.

## Verification

- `git diff --check` passed.
- `npm run build` passed.

Build still surfaced the existing landing showcase sold-listing query timeout during cache revalidation. This is unrelated to admin pool list loading and remains a separate follow-up.

## Deferred

The deeper optimization is to cache admin pool stats in a small summary table or runtime cache via warmer/housekeeper, then serve operator stats from that cache instead of recomputing from raw/listings on page load.
