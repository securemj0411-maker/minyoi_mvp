# Wave 872 Clothing Safe Public Tail Audit

Date: 2026-05-25

## Context
- Finished the remaining clothing `safe_public` tail audit.
- This wave targeted one-row/two-row ready lanes where a single stale or misrouted item can make sample comparisons look wrong.

## Scope
- Audited:
  - Acne sweat/tee/pants, Polo Chief Keef modern, BAPE crewneck/varsity, FOG Essentials hoodie/tee, Nike FOG collab, Arc'teryx Alpha/Down/Solano, TNF Mountain Jacket, TNF Supreme Nuptse, Junya Carhartt.

## Decisions Applied
- Added a matcher guard so Acne shoe listings cannot become `clothing-acne-pants` just because the description says they go well with slacks.
- Added Korean LEAF tokens to the Arc'teryx Alpha blocker so `리프 알파` routes to `clothing-arcteryx-leaf`.
- Applied current catalog reclassification after the guard fix.

## Applied Backfill
- Command: `scripts/apply-fashion-current-catalog-reclassify.ts --reason=wave872_clothing_safe_public_tail_audit --apply`
- Result:
  - scannedParsedRows: 745
  - candidateRows: 168
  - reclassifyRows: 35
  - refreshParsedRows: 120
  - rejectRows: 13

## Notable Routing
- Acne shoe bait:
  - `아크네 락어웨이/맨하탄 ... 슬랙스...` is now rejected/held instead of becoming Acne pants.
- Arc'teryx:
  - `아크테릭스 리프 알파 LT 자켓` now routes to `clothing-arcteryx-leaf`.
  - Down/Solano rows were recovered from Arc'teryx broad into explicit lanes.
- FOG:
  - Adidas Essentials rows route to Adidas lanes or reject instead of FOG Essentials.
  - Nike FOG apparel rows route into `clothing-nike-fog-collab`.
- BAPE and Junya:
  - BAPE varsity rows route from broad to varsity.
  - Junya Carhartt row routes from broad to collab.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - pass: 66
  - fail: 0
- `npx tsx scripts/run-market-stats-stage-once.ts`
  - queued: 17
  - enriched: 17
  - scored: 312
  - poolUpserted: 324
  - reveal_current_profit_updated: 1
  - reveal_current_profit_invalidated: 0
- `npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --apply`
  - candidateRows: 0
- Safety reports:
  - clothing: fixNow []
  - shoe: fixNow []
  - clothing readySku: 49, safePublic 41, probablySafe 8
  - shoe readySku: 83, safePublic 81, probablySafe 2

## Deferred
- Clothing safe-public audit is complete for this pass.
- Next pass should return to shoe safe-public/probably-safe sampling, then broaden to non-fashion category safety sweeps.
