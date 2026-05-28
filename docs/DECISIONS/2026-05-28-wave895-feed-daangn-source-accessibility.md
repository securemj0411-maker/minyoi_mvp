# Wave 895 - Feed Daangn Source Accessibility

Date: 2026-05-28

## Decision

The user asked whether the main feed can suffer from the same source-count issue that made the operator page undercount Daangn rows.

The feed does not use the operator source stats count path, so it is not directly affected by that pagination bug. However, the feed did have a related sampling problem: it fetched only the top 500 ready pool rows, then performed source diversification inside that sample. With Daangn ready rows now in the hundreds and total ready pool above the old assumptions, this can make Daangn feel underrepresented even when production has enough Daangn inventory.

## Changes

- Increased the feed ready candidate sample from 500 to 1,500.
- Added explicit offset pagination for the ready candidate fetch so PostgREST's 1,000-row cap cannot silently truncate the sample.
- Changed `mvp_listings` and `mvp_raw_listings` pid lookups to chunked fetches to avoid long `pid=in.(...)` URLs after the larger sample.
- Raised first-feed source protection from `daangn: 5, joongna: 5` to `daangn: 12, joongna: 3` for the 25 live ready slots.
- Applied Daangn distance actionability before source diversification, so the protected Daangn slots are nearby/reachable rows instead of rows that will be dropped later.
- Kept refresh/detail metadata bounded: refresh can inspect up to 500 diversified ready candidates, but the initial feed still returns only 30 items.

## Deferred

- A schema-level `source` column on `mvp_candidate_pool` or a dedicated source-aware feed RPC would be cleaner long term. That would remove the need for application-level raw source mapping.
- A/B tuning of the exact Daangn ratio is deferred until we see production feed composition after this deploy.
