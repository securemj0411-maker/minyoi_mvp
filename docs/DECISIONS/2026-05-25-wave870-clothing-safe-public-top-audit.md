# Wave 870 Clothing Safe Public Top Audit

Date: 2026-05-25

## Context
- Continued the clothing/shoe sample-pool safety sweep after `fixNow` reached zero.
- This wave audited high-volume `safe_public` clothing lanes to confirm public-ready SKUs were not still carrying stale broad or wrong-product comparable rows.

## Scope
- Audited first safe-public clothing batch:
  - Barbour quilted, Thom Browne cardigan/knit/shirt, Polo chino pants, Polo patterned shirt, Polo crewneck, Stone Island Crinkle Reps, Acne knit/denim/jacket, Stussy Nike, Patagonia Retro-X, TNF Denali, Adidas Trefoil.

## Decisions Applied
- Applied current catalog reclassification for stale rows only.
- Kept existing public readiness status unchanged because current matcher already blocks the main newly observed pollutants:
  - Polo chino pants no longer accepts caps, jackets, shirts, or shorts.
  - TNF Denali no longer accepts pants/setup-like polluted rows in current matching.
  - Patagonia Retro-X vest/file/fleece drift is rejected or routed away from Retro-X.
  - Adidas Trefoil carati/tee drift is rejected; track-top wording remains matchable.
- Treated Polo chino shorts/caps/jackets/shirts as historical contamination in `polo_pants_chino`, not as a reason to reopen `polo_pants_chino` itself.

## Applied Backfill
- Command: `scripts/apply-fashion-current-catalog-reclassify.ts --reason=wave870_clothing_safe_public_top_audit --apply`
- Result:
  - scannedParsedRows: 1592
  - candidateRows: 253
  - reclassifyRows: 98
  - refreshParsedRows: 139
  - rejectRows: 16

## Notable Routing
- Thom Browne broad rows were narrowed into cardigan/knit/shirt.
- Polo patterned/check/stripe/Hawaiian shirts were recovered from Polo broad into `clothing-polo-shirt-pattern`.
- Polo chino shorts/caps/jackets/shirts were removed from the ready chino-pants lane.
- Stone Island Crinkle Reps rows were recovered from Stone Island broad into `clothing-stone-island-crinkle-reps`.
- Patagonia Synchilla/Snap-T rows were removed from Retro-X.
- Stussy Nike rows were recovered from Stussy broad/null into `clothing-stussy-nike-collab`.

## Verification
- `npx tsx scripts/run-market-stats-stage-once.ts`
  - queued: 240
  - enriched: 240
  - scored: 1689
  - poolUpserted: 1502
  - reveal_current_profit_updated: 23
  - reveal_current_profit_invalidated: 11
- `npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --apply`
  - candidateRows: 0
- Safety reports:
  - clothing: fixNow []
  - shoe: fixNow []
  - clothing readySku: 49, safePublic 41, probablySafe 8
  - shoe readySku: 83, safePublic 81, probablySafe 2

## Deferred
- Continue safe-public clothing audits in smaller batches to keep review latency lower.
- After remaining clothing safe-public chunks, re-enter shoe safe-public/probably-safe spot audits and then non-fashion categories.
