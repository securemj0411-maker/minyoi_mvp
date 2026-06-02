# Wave 1016 — Landing Showcase Cache Hotpath

Date: 2026-06-02

## Finding

After the score-worker fix, the next clear DB inefficiency was the landing
showcase fallback.

The old fallback queried `mvp_raw_listings` directly:

- `listing_state=eq.sold_confirmed`
- `detail_status=eq.done`
- `listing_type=eq.normal`
- `thumbnail_url=not.is.null`
- `sku_name=not.is.null`
- `order=sold_detected_at.desc`

Production measurement:

- direct REST query failed after `8.3s`
- error: `57014 canceling statement due to statement timeout`

The intended cache table also did not exist in production:

- `mvp_landing_showcases` returned `PGRST205`
- local `supabase/schema.sql` had the table definition
- no migration file existed for it

So the landing path could not use the cache and then fell into an expensive raw
sold scan.

## Decision

Make landing showcases use already-scored ready pool rows instead of scanning
sold raw listings:

- source: `mvp_candidate_pool status=ready`
- listing metadata: `mvp_listings`
- active guard: `mvp_raw_listings.listing_state = active`
- expected profit: candidate pool official `expected_profit_min/max`
- market price: `mvp_listings.sku_median`, fallback to `buy + profit`

Also add a real migration for `mvp_landing_showcases` so the cache table exists
in production.

## Production DB Action

`supabase db push --dry-run` was not safe because remote migration history
contains versions not present in the local migrations directory.

Instead, applied only the additive Wave 1016 SQL directly:

- `create table if not exists public.mvp_landing_showcases`
- active-slot index
- RLS enabled
- anon/authenticated revoked
- service_role granted
- PostgREST schema reload notification

Verification:

- table exists: `to_regclass = public.mvp_landing_showcases`
- cache refresh with new local code inserted `10` rows
- REST cache read:
  - status `200`
  - `10` rows
  - `356ms`

## Verification

- `npm run build`
  - passed
  - previous landing sold-listing timeout warning disappeared
  - only existing `metadataBase` warnings remained
- primary Vercel deploy after commit:
  - `minyoi-acud5yckt...`
  - status `Ready`
- `/` public page response after deploy:
  - status `200`
  - `1.2s`

## Deferred

- Do not use `supabase db push` until migration history is repaired or
  intentionally reconciled.
- A future quality wave can enrich `sample_count` from `mvp_market_price_daily`;
  this wave intentionally prioritizes removing the timeout/cost hotpath.
