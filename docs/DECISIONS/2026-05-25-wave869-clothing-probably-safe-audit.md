# Wave 869 Clothing Probably Safe Audit

Date: 2026-05-25

## Context
- Audited the `probably_safe` clothing ready lanes with feedback/thin-ready signals before treating them as safe public sample pools.

## Scope
- Audited:
  - Polo Oxford, Polo knit sweater, Stussy hoodie, Patagonia Synchilla, Polo RRL denim, Lacoste pique polo, BAPE zip hoodie, Stussy zip hoodie.

## Decisions Applied
- Cleaned Stussy product-type drift:
  - Pullover hoodie rows that were actually crewneck/맨투맨 -> `clothing-stussy-crewneck-sweat`.
  - Pullover hoodie rows that were actually zip hoodie/후드집업 -> `clothing-stussy-zip-hoodie`.
  - Dice/World Tour special crewneck rows are rejected/held or routed out of basic Stussy crewneck.
- Polo knit full-zip/cardigan wording was recovered from Polo broad into `clothing-polo-knit-sweater`.

## Applied Backfill
- Command: `scripts/apply-fashion-current-catalog-reclassify.ts --reason=wave869_clothing_probably_safe_audit --apply`
- Result:
  - scannedParsedRows: 1216
  - candidateRows: 14
  - reclassifyRows: 10
  - refreshParsedRows: 0
  - rejectRows: 4

## Verification
- `npx tsx scripts/run-market-stats-stage-once.ts`
  - queued: 54
  - enriched: 54
  - scored: 1147
  - poolUpserted: 1275
  - reveal_current_profit_updated: 0
  - reveal_current_profit_invalidated: 0
- `npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --apply`
  - candidateRows: 0
- Safety reports:
  - shoe: fixNow []
  - clothing: fixNow []
  - clothing readySku: 49, safePublic 41, probablySafe 8.

## Deferred
- `probably_safe` count did not automatically promote to `safe_public`; feedback flags remain as audit markers even after current rows were cleaned.
- Continue with safe-public spot audits and non-fashion categories.

