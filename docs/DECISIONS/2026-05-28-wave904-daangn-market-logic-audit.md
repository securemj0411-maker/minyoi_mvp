# Wave 904 - Daangn Market Logic Audit

Date: 2026-05-28

## Decision

Daangn market price rows use the same market-stat engine as the mixed market rows, but scoped to `source=daangn`.

Confirmed behavior:

- Market stats use seller-level representative prices.
- Outliers are removed with MAD trim.
- Shoe / bag / clothing fake floor and high ceiling filters apply before aggregation.
- Ad / fake-selling description patterns are excluded before aggregation.
- Recent observations are weighted higher with exponential decay.
- Active, sold, and disappeared buckets are aggregated separately.
- Blended median gives more weight to sold rows as sold samples grow; active-only rows get a 0.92 negotiation haircut.
- Per-source rows are written to `mvp_market_price_daily_per_source` with the same blended logic.
- Daangn recommendations require usable Daangn source samples instead of falling back to mixed market evidence.

## Change

Added `basisSource`, `basisSourceLabel`, and `sourceSampleCount` to source-backed `RevealMarketBasis`.

This prevents a Daangn card that is priced from Daangn source stats from rendering chart/source labels as generic mixed market data.

## Deferred

Track Daangn `sold_confirmed` sample growth separately. If Daangn sold samples remain thin, active-only medians will remain haircut-based rather than transaction-heavy.
