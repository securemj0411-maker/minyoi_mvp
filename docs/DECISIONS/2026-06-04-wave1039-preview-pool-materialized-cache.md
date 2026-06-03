# Wave 1039 — preview-pool materialized DB cache

## Trigger

User clarified that the desired cache is not HTTP/Next fetch caching. The desired shape is:

- Every hour or few hours, compute the guest tasting/sample pool once.
- Store that computed sample set in the database.
- Guest landing users read only that stored sample set.

## Finding

`mvp_landing_showcases` and `/api/cron/landing-showcases` existed, but they belong to the older PackShop/intro landing showcase path.

The current guest main page uses `/api/preview-pool`. Before this wave, that route recomputed the sample pool at request time by querying candidate pool, raw listings, parsed rows, market prices, per-source market prices, and market velocity. The route only had HTTP cache headers / Next fetch revalidation, not a DB materialized cache.

## Decision

Add a dedicated materialized cache table for the current guest preview:

- New table: `mvp_preview_showcases`
- Public route: `/api/preview-pool`
  - Reads only `mvp_preview_showcases`
  - Does not query source/price/velocity tables per visitor
- New cron route: `/api/cron/preview-pool`
  - Recomputes the preview pool using the existing velocity-led selection logic
  - Writes the computed JSON payload into `mvp_preview_showcases`
- Vercel cron: hourly at minute 17

## Deferred

- Live production migration application was not performed in this code wave. The migration file is included and must be applied for production to serve non-empty materialized preview rows.
- Watchdog tracking for `preview-pool` was not added. This can be added later if guest acquisition traffic becomes important enough to alert on stale previews.
