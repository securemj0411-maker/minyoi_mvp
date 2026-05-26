# 2026-05-26 Daangn Direct Trade UX In `/me`

## Context
- User reported that Daangn listings in `/me` should behave like Joongna direct-only listings: before opening a product, show that it is a direct-trade listing and show the region.
- Daangn raw rows store region in `mvp_raw_listings.daangn_region_name`, while `raw_json` is intentionally slim and usually has no trade labels.

## Decisions
- Treat Daangn marketplace source as `direct_only` by default in marketplace safety inference.
- Include `daangn_region_name` in pool, detail-access, `/me`, and pack-open raw listing selects.
- Resolve `directTradeLocation` from raw JSON plus `daangn_region_name`, falling back to description parsing.
- Stop routing Daangn detail verification through Bunjang APIs in `/me`, pool detail access, and pack opening. Daangn has no Bunjang product detail endpoint, so those calls could wrongly mark items as disappeared.

## Deferred
- True Daangn live-detail verification remains deferred until a reliable Daangn detail API/parser exists.
- Daangn reveal-detail content is kept minimal instead of scraping a separate detail page.
