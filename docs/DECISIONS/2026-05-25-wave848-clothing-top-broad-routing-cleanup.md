# Wave 848 — Clothing top broad current-routing cleanup

## Context

After ready pool safety reached `fix_now=0`, the next highest ROI was not another public-ready rollback but reducing stale broad/internal routing in large clothing families. Top broad lanes had hundreds of eligible rows, and many were already recognizable by existing narrow rules.

Targeted broad families:

- Thom Browne
- Polo Ralph Lauren
- Stone Island
- Moncler
- Carhartt

## Decisions

1. Do not release broad lanes directly.
   - They remain internal/watch lanes because product/line spread is still high.
2. Reclassify stale broad rows into already audited narrow lanes when deterministic current catalog is clear.
3. When a repeated pattern is real but not public-proven, create an internal learning lane instead of leaving it broad/null.
   - Added `clothing-stone-island-overshirt` for Stone Island overshirt / Nylon Metal / Old Effect / stretch cotton twill rows.
   - This lane is intentionally not in ready readiness, so it learns/backfills but does not enter public-ready pool.
4. Tighten Carhartt ready lanes before applying.
   - Blocked T-shirts from `carhartt_shirt_flannel`.
   - Removed unsafe bare Korean `진` from `carhartt_denim_pants` because it matched normal words like `사진`.
   - Blocked puffer/vest/down/jacket from `carhartt_denim_pants`.
   - Blocked outer jackets from `carhartt_hoodie_sweat`.
   - Added direct routing for Carhartt active work hood jacket to `clothing-carhartt-active-jacket` (still internal by readiness).
   - Blocked T-shirts from `carhartt_heritage_usa`.
5. Tighten Polo Chino.
   - Blocked shirts/overshirts from `clothing-polo-pants-chino` after dry-run found `치노 밀리터리 셔츠 -> pants`.

## Applied DB routing

Thom Browne / Polo chunk:

- scannedParsedRows: 167
- rawRows: 167
- candidateRows: 125
- reclassifyRows: 65
- refreshParsedRows: 56
- rejectRows: 4

Stone / Moncler / Carhartt chunk:

- scannedParsedRows: 260
- rawRows: 260
- candidateRows: 98
- reclassifyRows: 55
- refreshParsedRows: 36
- rejectRows: 7

Notable routing:

- Thom Browne broad -> shirt / sweat-hoodie / knit / 4bar / suit-coat
- Polo broad -> vintage / shirt-pattern / refreshed broad only where still ambiguous
- Stone Island broad -> new `clothing-stone-island-overshirt` internal lane
- Moncler broad -> Maya / Grenoble / Tricot where explicit
- Carhartt broad -> shirt-flannel / hoodie-sweat / cargo / active-jacket or back to internal broad when jacket/tee/vest was unsafe for ready lane

## Verification

- Regression: `npx tsx --test tests/fashion-catalog-regression.test.ts` passed 46/46.
- Stage after both applies:
  - queued: 129
  - poolUpserted: 1338
  - reveal_current_profit_updated: 62
  - reveal_current_profit_invalidated: 10
- Gate cleanup:
  - clothing blocked-public residual: 0
  - shoe internal-only residual: 2
- Safety:
  - clothing readySku 46, safe_public 38, probably_safe 8, fix_now 0
  - shoe readySku 73, safe_public 70, probably_safe 3, fix_now 0

## Deferred

- Stone Island overshirt is internal-only until enough clean sample groups prove it can be public.
- Moncler Chloe / Hudson / Genius / Gamma Bleu remain model-specific deferred splits, not broad-ready.
- Carhartt outer jacket subtypes beyond Active/Detroit/Santa Fe remain internal broad until exact product lanes are proven.
