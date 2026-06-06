# Wave 1188 - Daangn prefetch cache and sync fallback

## Problem
- Production logs showed the first nearby Daangn quick feed request spending about 57s before returning 0 items.
- The nearby Daangn raw prefetch timed out/interrupted, then the API synchronously tried the deeper fallback path inside the same first paint request.
- The interrupted 0-row nearby prefetch result was also stored in the in-memory nearby cache. Follow-up refresh requests then cache-hit that failed 0-row result and could keep showing loading/empty states even though valid ready rows existed.

## Decision
- Treat interrupted nearby Daangn prefetch reasons as incomplete scan states, not cacheable results.
- Delete/ignore any cached nearby result with incomplete reasons (`raw_fetch_interrupted`, `pool_fetch_interrupted`, `budget_exhausted`, `timeout_fallback`, `failed`).
- Do not run the synchronous deep fallback on the quick first request when the initial nearby scan is incomplete. Return a `partial` feed state quickly and let the client continuation retry the heavier path.

## Deferred
- A proper persisted region-feed snapshot should still become the main hot path for local Daangn feeds. This patch only prevents the current timeout loop and poisoned memory cache from making the UI look stuck.
