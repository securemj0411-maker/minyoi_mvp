# Wave 866 Clothing Next Broad Audit

Date: 2026-05-25

## Context
- Continued the clothing deep sweep after Wave865, focusing on the next `watch_internal_only` broad lanes.

## Scope
- Audited current parsed/pool rows for:
  - Uniqlo, Lacoste, TNF Nuptse broad, Neighborhood, Nike tee broad, Adidas tee broad, Patagonia broad, Junya Watanabe broad, Tommy Hilfiger broad, MM6 Margiela broad.

## Decisions Applied
- Fixed Uniqlo coach-jacket false negative.
  - Previous blocker used bare `코치`/`coach` to prevent Coach-brand reference-only contamination.
  - This also blocked legitimate Uniqlo `코치 자켓` listings.
  - Replaced bare Coach blockers with explicit Coach collab/brand contexts (`coach x`, `x coach`, `코치 x`, etc.) while keeping Champion/leather-jacket reference blockers.
- TNF Nuptse variant rows were routed into explicit held/internal learning lanes instead of generic Nuptse broad:
  - `clothing-tnf-nuptse-vest`
  - `clothing-tnf-nuptse-eco`
  - `clothing-tnf-nuptse-special`
  - `clothing-tnf-white-label-novelty`
  - `clothing-tnf-nuptse-1992`
- No public release change was made for TNF variant broad/learning lanes; existing gate keeps them out unless already proven ready.

## Applied Backfill
- Command: `scripts/apply-fashion-current-catalog-reclassify.ts --reason=wave866_clothing_next_broad_audit --apply`
- Result:
  - scannedParsedRows: 642
  - candidateRows: 57
  - reclassifyRows: 17
  - refreshParsedRows: 40
  - rejectRows: 0

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 63/63 passed.
- `npx tsx scripts/run-market-stats-stage-once.ts`
  - queued: 64
  - enriched: 64
  - scored: 1820
  - poolUpserted: 1613
  - reveal_current_profit_updated: 31
  - reveal_current_profit_invalidated: 3
- `npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --apply`
  - candidateRows: 0
- Safety reports:
  - shoe: fixNow []
  - clothing: fixNow []
  - clothing readySku: 49, safePublic 41, probablySafe 8.

## Deferred
- TNF 700/500/850/Hybrid/Quantum generic Nuptse broad remains internal-only/watch because product-year/fill/white-label/vest/eco/special axes still differ materially.
- MM6 broad produced only refresh in this pass; no new model split was released.

