# Wave 953 — Daangn nearby feed priority

## Context

The public `/me` feed was loading a profit-ordered candidate slice first and then sorting Daangn items inside that slice. This meant nearby Daangn listings, such as Heukseok-dong items visible in the operator pool, could be absent from the user feed if they were outside the profit-overfetch slice.

## Decision

- Keep the existing profit-ordered pool fetch as the broad fallback.
- Add a Daangn-local prefetch path for users with a saved home region:
  - Resolve nearby Daangn region ids within the configured radius.
  - Include both generated search ids and parent/administrative ids, because raw rows may store ids such as Heukseok-dong `331`.
  - Load active/done Daangn raw rows from those region ids, then keep only matching `candidate_pool.status=ready` rows.
  - Merge those rows before the profit-ordered fallback so nearby Daangn candidates win ordering.
- Increase the protected Daangn source quota for the first feed slice and let local Daangn quota bypass category caps, because direct-trade distance is more important than category diversity for this source.
- When the user selects `가까운 순 (당근)`, request `sort=distance` from the server instead of only sorting the already-loaded client snapshot.
- Preserve URL/source state on initial load by letting the feed request pass the current source filter to the server.
- Follow-up speed fix:
  - Query nearby Daangn regions in distance-ordered batches instead of fetching one broad latest-first 4000-row slice.
  - Stop early once the first feed slice has enough ready Daangn rows.
  - Reduce the broad profit-pool overfetch when Daangn distance/source is the primary view.
  - Cache warm nearby rows briefly per home-region/source/sort key.
  - Log structured nearby prefetch stats when slow or when `FEED_DEBUG_LOG=1`.
  - Show a designed loading state while nearby Daangn candidates are being checked.

## Config

- `DAANGN_NEARBY_FEED_RADIUS_KM` default `10`
- `DAANGN_NEARBY_FEED_REGION_LIMIT` default `260`
- `DAANGN_NEARBY_FEED_RAW_LOOKUP_LIMIT` default `4000`
- `DAANGN_NEARBY_FEED_REGION_BATCH_SIZE` default `32`
- `DAANGN_NEARBY_FEED_REGION_BATCH_RAW_LIMIT` default `1000`
- `DAANGN_NEARBY_FEED_POOL_LOOKUP_LIMIT` default `700`
- `DAANGN_NEARBY_FEED_BOOST_LIMIT` default `120`
- `DAANGN_NEARBY_FEED_CACHE_TTL_MS` default `45000`
- `DAANGN_NEARBY_FEED_SLOW_LOG_MS` default `1200`
- `DAANGN_FEED_SOURCE_QUOTA` default `18`
- `JOONGNA_FEED_SOURCE_QUOTA` default `3`

## Verification

- `npx tsx --test tests/daangn-region-distance.test.ts`
- `npx eslint src/lib/daangn-region-distance.ts tests/daangn-region-distance.test.ts src/app/api/packs/pool/route.ts src/components/explore-client.tsx`
- `npm run build`

## Deferred

- Consider a dedicated materialized nearby-region lookup if feed traffic grows enough for route-time region resolution to matter.
