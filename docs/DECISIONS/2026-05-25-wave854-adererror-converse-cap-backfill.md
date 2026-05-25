# Wave 854 — Ader Error Converse cap backfill

## Context

Safety after wave 853 showed one ready shoe fix_now: `shoe-adererror-converse-collab`. The polluted row was:

- pid `382146732`: `아더에러 X 컨버스 볼캡`

The current matcher already rejects this as a cap/accessory row. The remaining issue was stale current/pool state.

## Decisions

1. Keep `shoe-adererror-converse-collab` public-ready for actual sneakers.
2. Reject the stale cap accessory row to null/review.
3. Add regression coverage so cap rows cannot re-enter this ready shoe lane.

## Applied DB routing

Wave 854 apply:

- scannedParsedRows: 1
- rawRows: 1
- candidateRows: 1
- reclassifyRows: 0
- refreshParsedRows: 0
- rejectRows: 1

## Verification

- Regression: `npx tsx --test tests/fashion-catalog-regression.test.ts` passed 52/52.
- Stage after apply:
  - queued: 38
  - poolUpserted: 952
  - reveal_current_profit_updated: 5
  - reveal_current_profit_invalidated: 0
- Gate cleanup:
  - candidateRows: 0
- Final safety:
  - shoe readySku 81, safe_public 79, probably_safe 2, fix_now 0
  - clothing readySku 46, safe_public 38, probably_safe 8, fix_now 0

## Deferred

- Keep watching ADER Converse comparable samples for non-shoe accessories, but no public pause is needed after this single stale cap row was removed.
