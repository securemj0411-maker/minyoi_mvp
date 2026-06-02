# 2026-06-02 wave1006 - Feed nearby Daangn timeout guard

## Context

Production `/api/packs/pool` started returning failures to the user feed, causing the UI to show "매물을 가져오지 못했어요".

Vercel logs showed the user-facing pool request was blocked by nearby Daangn prefetch work:

- `nearby daangn prefetch enabled: true`
- `regionCount: 260`
- `regionBatches: 4`
- `rawRows: 4000`
- `candidatePids: 1800`
- `elapsedMs: 44~45s`
- request failed with `The operation was aborted due to timeout`

This was not a Telegram alert suppression issue. The alerting path was left intact; the incident was a feed hot-path timeout.

## Decision

Keep the nearby Daangn boost, but make it bounded and non-fatal:

- Reduce default nearby prefetch fan-out for feed requests.
- Add a feed prefetch budget.
- Stop scanning region batches once the budget is exhausted.
- Wrap raw listing and candidate pool lookup steps in timeouts.
- If nearby prefetch times out, log a fallback and return the normal ready pool instead of failing the whole feed.

## Implementation

Changed `src/app/api/packs/pool/route.ts`:

- `DAANGN_NEARBY_FEED_REGION_LIMIT`: default `260 -> 96`
- `DAANGN_NEARBY_FEED_RAW_LOOKUP_LIMIT`: default `4000 -> 1200`
- `DAANGN_NEARBY_FEED_REGION_BATCH_SIZE`: default `32 -> 24`
- `DAANGN_NEARBY_FEED_REGION_BATCH_RAW_LIMIT`: default `1000 -> 300`
- `DAANGN_NEARBY_FEED_POOL_LOOKUP_LIMIT`: default `700 -> 250`
- `DAANGN_NEARBY_FEED_BOOST_LIMIT`: default `120 -> 36`
- Added `DAANGN_NEARBY_FEED_PREFETCH_BUDGET_MS`, default `4500`.
- Added nearby prefetch fallback stats reason: `timeout_fallback`.

## Verification

- `npm run build` passed.
- `git diff --check` passed.

Build did surface an existing runtime cache revalidation warning for landing showcase data:

- `mvp_raw_listings` sold showcase query hit Supabase statement timeout during static generation cache revalidation.
- Build continued and completed successfully.
- This is separate from the feed API failure and should be tracked separately if landing preview data remains stale.

## Deferred

- Further optimize nearby Daangn lookup with a dedicated RPC or materialized nearby-ready cache if the bounded prefetch still logs frequent fallbacks.
- Investigate landing showcase sold-listing query timeout separately.
