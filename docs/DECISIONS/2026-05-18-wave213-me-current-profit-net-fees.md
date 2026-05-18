# 2026-05-18 Wave 213 — `/me` current profit must use net fee-aware profit

## Problem
- Wave 208~212 made `/me` request-time market price the display source of truth.
- The displayed value was still computed as `market median - listing price`, so it ignored the operator pool profit model.
- That made `/me` and the replay modal overstate profit because buyer shipping, selling fee, resell shipping, and safety buffer were not deducted.

## Decision
- `/api/packs/me` now computes signed current net profit using the same cost model as `mvp_candidate_pool`:
  - current market/reference median
  - listing price plus buyer shipping/general shipping
  - `estimated_buy_cost`
  - selling fee `3.5%`
  - resell shipping fee `3,500`
  - safety buffer `5,000`
- Current profit remains signed rather than clamped. Negative values are required so `/me` can show `시세 갱신 — 추천 무효`.
- The API now returns min/max current net profit, writes those values back to `mvp_pack_reveals.current_profit_min/max`, and uses the min value for conservative invalidation.
- Fresh reveal inserts initialize `current_profit_*` from the candidate pool's net `expected_profit_*`, not raw market-price gap.
- `/me` optimistic additions and replay modals now render the net profit range instead of recalculating raw `median - price` on the client.

## Deferred
- A dedicated frontend field name such as `currentNetProfitMinKrw` would be clearer than the legacy `marketGapKrw`; this was deferred to avoid widening the response contract during the hotfix.
- Candidate pool repricing remains a separate cron/pipeline concern. This wave only fixes user-visible `/me` request-time display/write-through.
