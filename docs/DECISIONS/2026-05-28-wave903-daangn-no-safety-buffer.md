# Wave 903 - Daangn No Safety Buffer In Profit

Date: 2026-05-28

## Decision

Daangn profit should not subtract the fixed `SAFETY_BUFFER`.

Reasoning:

- Daangn resale is modeled as local direct trade.
- We already set Daangn selling fee to `0원` and resell shipping to `0원`.
- A fixed 5,000 KRW safety buffer made low-priced Daangn listings look less profitable than the actual direct-trade math.
- The risk still exists, but it is negotiation / travel / no-show risk rather than a deterministic transaction cost.

## Changes

- Added `safetyBufferForSource()`.
- `expectedProfitFromMarketPrice()` now subtracts `0원` safety buffer for Daangn and keeps `5,000원` for other marketplaces.
- `/me` current profit recomputation uses the same source-aware safety buffer.
- Candidate pool profit building uses source-aware selling fee, resell shipping, and safety buffer.
- Detail modal copy now says Daangn is `직거래 기준` and moves negotiation / travel / no-show risk into a separate checklist note instead of subtracting it from profit.

## Deferred

- If Daangn no-show / travel cost becomes material, add a separate optional “local effort cost” display instead of mixing it into expected profit.
