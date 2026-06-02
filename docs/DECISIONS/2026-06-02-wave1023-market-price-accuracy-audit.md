# 2026-06-02 — Wave 1023 Market price accuracy audit

## Context

User asked whether the current market-price calculation is accurate enough, with Daangn as the most important source. Previous Wave 1022 had already changed Daangn to fail closed when same-source market basis is missing.

## Production read-only audit

Latest market rows:

- `mvp_market_price_daily_per_source`: 2026-06-02, latest `computed_at` 13:12 UTC.
- `mvp_market_price_daily`: 2026-06-02, latest `computed_at` 13:12 UTC.

Per-source rows on 2026-06-02:

- Daangn: 429 rows; 276 rows have active+sold sample >= 3 and a usable blended price. 210 rows are sold-backed; 219 rows are active-only.
- Bunjang: 1000 fetched rows; 671 usable rows; 298 sold-backed.
- Joongna: 768 rows; 337 usable rows; 253 sold-backed.

Daangn vs mixed market rows:

- Comparable rows with Daangn usable sample >= 3: 57.
- Ratio p10/p50/p90: 0.72 / 1.00 / 1.19.
- Conclusion: mixed market is not safe as a Daangn fallback. Some keys differ by 30%+.

Ready Daangn sample audit:

- First 1000 ready rows fetched: 947 Daangn, 46 Bunjang, 7 Joongna.
- Daangn exact same-source basis usable: 746.
- Daangn rows with missing exact same-source basis: 201.
- Many of those had some other condition/tier row available, but using that would violate the same-source/same-state trust promise.

## Decisions implemented

1. `pickByConditionFallback` now tries exact `condition_tier + condition_class` first.
   - This fixes tiered categories such as golf/game where rows can be stored as `a_grade|clean`.
   - It still supports fashion rows stored as classless `A|`, `B|`, etc.
   - It no longer borrows arbitrary different-tier rows.

2. Daangn now fails closed on source condition/tier fallback.
   - Feed route source-aware median returns null when the Daangn source row is only a fallback condition/tier.
   - Detail/easy-mode market basis also requires non-fallback same-source basis.
   - Score stage also blocks Daangn source fallback basis from becoming a ready profit basis.

3. Market history chart is now condition-tier aware.
   - `/api/market/history` accepts `tier`.
   - `MarketHistoryChart` sends `conditionTier`.
   - Detail/easy-mode and admin-pool charts pass the card tier.

4. Non-login preview pool is now more source/tier aware.
   - It fetches parsed condition tier and per-source market rows.
   - Daangn preview examples require same-source usable basis and do not fall back to mixed market.

## Verification

- `npx tsx --test tests/daangn-market-basis-contract.test.ts`
- `npm run build`

Both passed.

## Deferred

- Active-only price factor is still a single `0.92` discount. It is not a simple average, but it should become source/category calibrated once more sold lifecycle data accumulates.
- Exact same-condition policy may reduce Daangn ready throughput. That is intentional for price trust; throughput should be recovered by improving lifecycle/price-sweep coverage, not by borrowing mixed or wrong-condition rows.
