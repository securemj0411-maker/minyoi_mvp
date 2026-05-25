# Wave 867 Clothing Mid Broad Audit

Date: 2026-05-25

## Context
- Continued clothing deep sweep into mid-size `watch_internal_only` broad lanes after Wave866.

## Scope
- Audited current parsed/pool rows for:
  - J.Lindeberg, Canada Goose, Thisisneverthat, Titleist, Schott, Nanamica, TNF Himalayan, BAPE jacket broad, CDG Homme broad, Mark & Lona, FootJoy, BlackYak, PXG, FOG main pants, Mountain Hardwear.

## Decisions Applied
- Nike/Fear of God apparel matching now requires an apparel product token.
  - Added warm-up typo/token coverage: `웜업`, `윔업`, warm-up, hoodie, jacket, pants, shorts.
  - Removed over-broad Korean `에어 피어` blocker from the apparel collab lane while keeping explicit shoe blockers.
  - This fixes `나이키에어 피어오브갓 윔업 팬츠` from null/mainline FOG to `clothing-nike-fog-collab`.
- BAPE jacket axis cleanup:
  - `코치자켓` rows -> `clothing-bape-coach-jacket`.
  - `바시티자켓` rows -> `clothing-bape-varsity-jacket`.
  - BAPE shirt-jacket row remains null/held instead of polluting jacket broad.
- CDG Homme cleanup:
  - Homme Plus wording routes to `clothing-cdg-homme-plus`.
  - Homme generic apparel stays in broad/internal.
- Schott broad keeps leather/rider jackets only; Schott chino pants are held/null.
- PXG listings wrongly sitting in FOG Essentials pants are rehomed to PXG broad/internal.

## Applied Backfill
- Command: `scripts/apply-fashion-current-catalog-reclassify.ts --reason=wave867_clothing_mid_broad_audit --apply`
- Result:
  - scannedParsedRows: 527
  - candidateRows: 62
  - reclassifyRows: 19
  - refreshParsedRows: 41
  - rejectRows: 2

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 64/64 passed.
- `npx tsx scripts/run-market-stats-stage-once.ts`
  - queued: 56
  - enriched: 56
  - scored: 1794
  - poolUpserted: 1349
  - reveal_current_profit_updated: 10
  - reveal_current_profit_invalidated: 3
- `npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --apply`
  - candidateRows: 0
- Safety reports:
  - shoe: fixNow []
  - clothing: fixNow []
  - clothing readySku: 49, safePublic 41, probablySafe 8.

## Deferred
- TNF Himalayan, Titleist, golf broad brands, BAPE jacket broad, and FOG main pants remain internal/watch unless narrow/model axes prove safe.
- No broad public release was added in this wave.

