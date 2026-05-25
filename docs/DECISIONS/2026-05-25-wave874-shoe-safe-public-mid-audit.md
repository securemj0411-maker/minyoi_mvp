# Wave 874 Shoe Safe Public Mid Audit

Date: 2026-05-25

## Context
- Continued shoe safe-public audit after the probably-safe/top-public pass.
- This wave focused on mid ready lanes with collab/generic model collisions.

## Scope
- Audited:
  - Adidas Ultraboost, Onitsuka Mexico 66, Yeezy Slide, Adidas F50, Hoka Mafate Speed, Puma Open YY, Stussy Converse, Asics Gel Sonoma, Asics Metaspeed, Supreme Dr. Martens, Asics Cecilie Bahnsen, Adidas FOG, Salomon XA Pro, Off-White Nike Air Max, Travis SB Dunk.

## Decisions Applied
- Fixed Asics direct matcher priority:
  - `세실리에/반센/Cecilie/Bahnsen` now resolves to `shoe-asics-cecilie-bahnsen-collab` before generic Gel Quantum direct matching.
- Applied parsed-key refresh after the fix.

## Applied Backfill
- Command: `scripts/apply-fashion-current-catalog-reclassify.ts --reason=wave874_shoe_safe_public_mid_audit --apply`
- Result:
  - scannedParsedRows: 795
  - candidateRows: 59
  - reclassifyRows: 0
  - refreshParsedRows: 59
  - rejectRows: 0

## Notable Routing
- Prevented `아식스 x 세실리에 반센 젤 퀀텀 360` from moving into generic `shoe-asics-gel-quantum-360`.
- After the fix, the wave had no SKU reclassification and no rejects; only comparable-key refreshes remained.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - pass: 67
  - fail: 0
- `npx tsx scripts/run-market-stats-stage-once.ts`
  - queued: 109
  - enriched: 109
  - scored: 1817
  - poolUpserted: 1715
  - reveal_current_profit_updated: 27
  - reveal_current_profit_invalidated: 5
- `npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --apply`
  - candidateRows: 0
- Safety reports:
  - shoe: fixNow []
  - clothing: fixNow []
  - shoe readySku: 83, safePublic 81, probablySafe 2

## Deferred
- Continue shoe safe-public audit in lower ready-count chunks.
- Watch Asics collab/generic intersections for future rows before adding more exact collab lanes.
