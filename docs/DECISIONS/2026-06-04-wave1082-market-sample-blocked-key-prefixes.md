# 2026-06-04 Wave 1082 - Market Sample Blocked Key Prefixes

## Decision
- Candidate pool cleanup alone is not sufficient for broad golf/clothing lanes.
- Sold, terminal, and historical parsed rows still feed `mvp_market_price_daily` and `mvp_market_velocity_daily`, so broad comparable keys must be blocked at the market sample layer too.
- Keep raw/parsed history for future reparse, but exclude known broad family comparable key prefixes from public market stats.

## Implemented
- Added `src/lib/market-key-policy.ts` with shared blocked comparable-key prefixes.
- Updated TypeScript market price daily generation to skip blocked keys before grouping active/sold/disappeared samples.
- Added SQL policy table `mvp_market_blocked_key_prefixes`.
- Replaced `sync_market_velocity_daily_for_category` so SQL velocity aggregation skips blocked prefixes.
- Deleted existing daily price/velocity rows for blocked prefixes.

## Live DB verification
- `blocked_prefixes`: 21
- `blocked_price_daily`: 0
- `blocked_velocity_daily`: 0
- `blocked_parsed_history_retained`: 21,774

## Deferred
- Do not delete `mvp_listing_parsed` / `mvp_raw_listings`; those rows are source history and should be reused when narrower golf/clothing SKU parsers are added.
- Add narrower public lanes for golf club models and clothing brand/product splits only after sample purity audits pass.
