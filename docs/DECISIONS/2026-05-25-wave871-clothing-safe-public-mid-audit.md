# Wave 871 Clothing Safe Public Mid Audit

Date: 2026-05-25

## Context
- Continued safe-public clothing audit after Wave 870.
- Focused on small-sample public lanes where a single polluted row can make comparison samples look strange.

## Scope
- Audited:
  - BAPE Shark Hoodie, Stone Island Shadow Project, Patagonia Down, Polo RRL shirt/pants, CDG Homme Plus, Arc'teryx Veilance/LEAF/Gamma/Beta LT/Proton.

## Decisions Applied
- Applied current catalog reclassification and parsed-key refreshes.
- Kept public readiness unchanged for verified narrow lanes.
- Let current matcher reject/hold exchange-only, accessory, style-reference, and unproven variant rows rather than force them into public ready lanes.
- Preserved Arc'teryx sub-line split behavior:
  - Beta broad rows were routed into Beta SL, Beta AR, or Beta LT where explicit tokens existed.

## Applied Backfill
- Command: `scripts/apply-fashion-current-catalog-reclassify.ts --reason=wave871_clothing_safe_public_mid_audit --apply`
- Result:
  - scannedParsedRows: 633
  - candidateRows: 122
  - reclassifyRows: 17
  - refreshParsedRows: 91
  - rejectRows: 14

## Notable Routing
- RRL jacket/work/chore/leather-suede rows were recovered from null into explicit RRL lanes.
- RRL wallets, rings, bracelets, style-reference rows, and unsupported RRL variants were kept out of public clothing samples.
- CDG Homme Plus broad rows were narrowed into `clothing-cdg-homme-plus`.
- Arc'teryx Beta rows split into SL/AR/LT lanes instead of staying in the old broad Beta lane.
- Arc'teryx Veilance and Gamma rows refreshed comparable keys; Gamma pants and jackets remain separated by product type in the comparable key.

## Verification
- `npx tsx scripts/run-market-stats-stage-once.ts`
  - queued: 41
  - enriched: 41
  - scored: 1739
  - poolUpserted: 1485
  - reveal_current_profit_updated: 18
  - reveal_current_profit_invalidated: 7
- `npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --apply`
  - candidateRows: 0
- Safety reports:
  - clothing: fixNow []
  - shoe: fixNow []
  - clothing readySku: 49, safePublic 41, probablySafe 8
  - shoe readySku: 83, safePublic 81, probablySafe 2

## Deferred
- Continue with remaining clothing safe-public tail.
- Re-check BAPE Shark Hoodie sample health later if first-camo/ABC-camo rows accumulate enough to justify a separate internal variant lane.
