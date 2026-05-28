# Wave 898 - Daangn Feed Source Profit

Date: 2026-05-28

## Decision

The user asked whether Daangn feed cards were actually using Daangn market prices and Daangn cost assumptions.

They were not fully source-aware:

- `/api/packs/pool` still used mixed `mvp_market_price_daily` bands for teaser/feed `skuMedian`.
- Feed-side profit recomputation still subtracted the generic marketplace seller fee and resell shipping fee.
- The client-side lazy analysis recompute also reused the same generic cost formula.

This made Daangn feed profits look inconsistent with Daangn's usual direct-trade/no-fee behavior.

## Changes

- Added source-aware profit helpers:
  - Daangn selling fee = 0
  - Daangn resell shipping fee = 0
  - Existing safety buffer remains
- The feed pool API now loads `mvp_market_price_daily_per_source`.
- Daangn feed rows now require Daangn source market stats with at least 3 active/sold samples.
- If a Daangn source median is missing, the row is excluded from the feed instead of falling back to mixed market.
- Bunjang/Joongna may still prefer source stats when available and fall back to mixed stats.
- Explore client lazy recompute now uses source-aware profit math and invalidates stale Daangn mixed profit when analysis reports missing Daangn basis.
- Initial feed `marketBasis` marks Daangn rows as Daangn-based so charts/detail copy do not start from a mixed basis label.

## Deferred

- Existing DB candidate_pool rows may still carry old expected_profit until score/market workers refresh them, but the user feed response now recomputes before display.
- The detailed modal has older copy blocks that mention generic marketplace fees in explanatory text. The numeric feed/detail profit path is fixed first; copy cleanup can follow if screenshots still show fee mismatch.
