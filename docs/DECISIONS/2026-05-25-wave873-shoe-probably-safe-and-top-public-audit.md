# Wave 873 Shoe Probably Safe And Top Public Audit

Date: 2026-05-25

## Context
- Returned to shoe sample safety after finishing the clothing safe-public pass.
- Started with the two `probably_safe` shoe lanes and the highest ready-count safe-public shoe lanes.

## Scope
- Audited:
  - Hoka Satisfy Mafate, New Balance Casablanca 327, Yeezy 500/700, Mizuno Alpha/Sala/Morelia Neo, On Running PAF, Adidas Samba Wales Bonner, Yeezy Quantum, Birkenstock Boston, Jordan 1 Mid, Hoka Mafate XLIM.

## Decisions Applied
- No new matcher rules were needed in this wave.
- Applied current catalog reclassification because dry-run showed only safe stale routing:
  - Hoka Mafate Speed rows with explicit XLIM collaboration wording moved to `shoe-hoka-mafate-xlim-collab`.

## Applied Backfill
- Command: `scripts/apply-fashion-current-catalog-reclassify.ts --reason=wave873_shoe_probably_safe_and_top_public_audit --apply`
- Result:
  - scannedParsedRows: 673
  - candidateRows: 57
  - reclassifyRows: 4
  - refreshParsedRows: 53
  - rejectRows: 0

## Verification
- `npx tsx scripts/run-market-stats-stage-once.ts`
  - queued: 22
  - enriched: 22
  - scored: 359
  - poolUpserted: 315
  - reveal_current_profit_updated: 1
  - reveal_current_profit_invalidated: 0
- `npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --apply`
  - candidateRows: 0
- Safety reports:
  - shoe: fixNow []
  - clothing: fixNow []
  - shoe readySku: 83, safePublic 81, probablySafe 2
  - clothing readySku: 49, safePublic 41, probablySafe 8

## Deferred
- Continue with shoe safe-public middle/tail chunks.
- If repeated XLIM/Satisfy/Mafate colorway drift appears, consider exact colorway lanes only after enough raw rows accumulate.
