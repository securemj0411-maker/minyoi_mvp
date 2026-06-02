# 2026-06-02 Wave 1026 — Feed Hotpath Daangn Latency

## Context

User reported the `/me` feed feels too slow, while Daangn-first and nearby-distance ordering should not be sacrificed.

Read-only timing showed the hot path was not a single broken Supabase query. The expensive shape was the feed assembling too much data before the first page:

- The default ready pool path could read up to 1500 candidate rows before narrowing to 30 response cards.
- Candidate pool does not currently store buy price, so budget filters still need `mvp_listings.price` and cannot be narrowed safely at the pool query alone.
- Top ready candidates already contain enough Daangn rows for the first screen, so the unbudgeted first feed does not need the full 1500-row scan.
- The feed also live-verified Daangn cards before returning the list. Detail access still performs source-aware live verification before consuming a free view/credit, so list-time full verification is redundant and can make the feed wait on external Daangn requests.

## Decision

Apply a non-destructive hot-path reduction:

- Keep Daangn-first and distance ordering.
- Keep the wide scan for budget-filtered requests, because price filtering currently requires joining listing rows.
- Keep the wide scan for non-Daangn source-only filters.
- Reduce the unbudgeted first-feed candidate scan from the global 1500 default to an env-configurable 600.
- Reduce Daangn source-only default scan to 600 unless overridden.
- Bound list-time Daangn live verification to a small top-card sample.
- Leave detail-access live verification unchanged.

This is intentionally not a schema change. The deeper structural fix is adding a feed snapshot/RPC or denormalizing buy price/source into `mvp_candidate_pool`.

## Implementation

Changed `src/app/api/packs/pool/route.ts`:

- Added `FEED_INITIAL_READY_OVERFETCH` default `600`.
- Added `DAANGN_FEED_SOURCE_READY_OVERFETCH` default `600`.
- Added `DAANGN_POOL_LIVE_VERIFY_MAX_TARGETS` default `4`.
- Added `DAANGN_POOL_LIVE_VERIFY_TIMEOUT_MS` default `900`.
- Added `readyPoolOverfetchLimit()` to keep budget/source safety rules explicit.
- List-time Daangn live verification now checks only the first bounded targets; exact detail opening remains protected by `/api/packs/pool/detail-access`.

## Deferred

- Add a DB-side feed RPC or snapshot table if feed latency is still high under budget filters.
- Consider denormalizing source and buy price into `mvp_candidate_pool` so source/budget filters can be applied before raw/listing fan-out.
