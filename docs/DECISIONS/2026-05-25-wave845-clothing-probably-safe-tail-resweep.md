# 2026-05-25 Wave845 — Clothing Probably-Safe Tail Resweep

## Context
- After Wave844, clothing had 47 ready SKUs: 39 `safe_public`, 8 `probably_safe`, 0 `fix_now`.
- The remaining `probably_safe` lanes were mostly not currently dirty, but carried historical operator feedback and sample-tail risk:
  - Polo knit/Oxford
  - Stussy hoodie/zip/crewneck
  - Patagonia Synchilla
  - RRL denim
  - BAPE zip hoodie
  - Lacoste pique polo

## Decision
- Do not force public readiness just to keep ready count high.
- Re-sweep all comparable-key tails for the 8 `probably_safe` lanes.
- Apply only deterministic current-catalog changes:
  - Stussy special/collab zip/hoodie rows -> reject
  - Patagonia Synchilla rows still sitting in Retro-X keys -> Synchilla
  - RRL denim jacket/shirt/pants rows -> their current exact/internal lanes
  - Lacoste generic tee/shirt rows -> Lacoste broad/internal
- Add catalog blockers so new raw rows do not recreate the Stussy mistakes.

## Code Changes
- `src/lib/generated/catalog-805-fashion-axis-splits.ts`
  - Added Stussy special-axis blockers to common Stussy crewneck/zip noise:
    Our Legacy/Workshop, CPFM, World Tour, Dover/DSM, Martine Rose, Futura, Dice, Soul 1980, pigment.
- `src/lib/catalog.ts`
  - Added direct Stussy special-axis handling for `skull`, `bones`, and `pig dyed` variants.
  - Added hoodie blockers for `skull bones`, `skull`, `bones`, `pig. dyed`, `pig dyed`, `pigdye`.
- `src/lib/generated/catalog-715-clothing-narrow.ts`
  - Blocked Our Legacy/Workshop/pigment from `clothing-stussy-vintage-collab`, so modern Workshop rows do not resurrect into the ready vintage lane through description text.
- `tests/fashion-catalog-regression.test.ts`
  - Added Stussy Our Legacy Workshop and Skull & Bones/PIG dyed regression coverage.

## Apply Result
- Command: `apply-fashion-current-catalog-reclassify.ts --apply`
- Scope: all comparable keys from the 8 clothing `probably_safe` lanes.
- `scannedParsedRows`: 1307
- `candidateRows`: 46
- `reclassifyRows`: 26
- `refreshParsedRows`: 11
- `rejectRows`: 9

Representative decisions:
- `스투시 SKULL & BONES PIG. DYED HOODIE 팝니다.` — Stussy hoodie -> rejected
- `스투시 아워레가시 워크샵 맨투맨 L사이즈` — Stussy hoodie -> rejected
- `아워레가시 스투시 워크샵 오발집 후드집업 XL` — Stussy zip hoodie -> rejected
- `파타고니아 신칠라 풀오버 후리스 폭스레드 xs` — Retro-X -> Synchilla
- `RRL LOT271 블랙 데님 자켓` — null/stale -> RRL denim jacket internal lane
- `라코스테반팔티셔츠(95)` — Lacoste pique -> Lacoste broad internal lane

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 44 passed / 0 failed.
- `npx tsx scripts/run-market-stats-stage-once.ts`
  - `queued`: 136
  - `poolUpserted`: 1641
  - `reveal_current_profit_updated`: 26
  - `reveal_current_profit_invalidated`: 13
- `npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --apply`
  - 2 stale shoe internal-only rows invalidated; no clothing blocked public leakage.
- `npx tsx scripts/report-shoe-sku-safety.ts --category=clothing`
  - ready SKU: 46
  - `safe_public`: 38
  - `probably_safe`: 8
  - `fix_now`: 0
- `npx tsx scripts/report-shoe-sku-safety.ts --category=shoe`
  - ready SKU: 70
  - `safe_public`: 67
  - `probably_safe`: 3
  - `fix_now`: 0

## Notes
- Clothing ready SKU count decreased by 1 because the last Lacoste pique public-ready row was generic tee/shirt, not a clean pique polo comparison. This is an intended quality trade-off, not an API/pool outage.
- Shoe ready SKU count decreased by 1 due stale internal-only cleanup, not because a new shoe lane was broadly disabled.

## Deferred
- Remaining `probably_safe` lanes still have historical feedback, but current-catalog check shows no `fix_now`.
- Next pass should inspect shoe `probably_safe` 3 lanes and high-feedback broad watch/internal lanes for split candidates.

