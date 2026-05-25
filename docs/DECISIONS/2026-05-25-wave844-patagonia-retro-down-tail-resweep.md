# 2026-05-25 Wave844 — Patagonia Retro-X / Synchilla / Down Tail Resweep

## Context
- Remaining clothing `probably_safe` lanes still included Patagonia feedback around Synchilla/Retro-X sample mixing.
- Dry-run showed many `patagonia_retro_x` rows were actually Synchilla, generic fleece, Retro Pile, or ambiguous vintage/celebrity rows.

## Decision
- Keep explicit Retro-X rows public.
- Move explicit Synchilla/Snap-T rows out of Retro-X and into `clothing-patagonia-synchilla`.
- Move generic fleece/jacket/vest rows to `clothing-patagonia-apparel-broad`, which remains internal/watch-only.
- Reject ambiguous Retro Pile, vintage/celebrity, and stale-current rows.
- Add a systemic blocker for Nike/Nocta/ACG reference wording on Patagonia down/broad lanes so `나이키 ... 녹타 ... 파타고니아` style rows do not enter Patagonia comparisons in future ingests.

## Code Changes
- `src/lib/catalog.ts`
  - Added Patagonia down `mustNotContain` blockers: `나이키`, `nike`, `녹타`, `nocta`, `acg`.
- `src/lib/generated/catalog-wave266-clothing.ts`
  - Added the same blockers to `clothing-patagonia-apparel-broad`.
- `tests/fashion-catalog-regression.test.ts`
  - Added regression coverage that Nike/Nocta down reference text does not match Patagonia down.

## Apply Result
- Command: `apply-fashion-current-catalog-reclassify.ts --apply`
- Scope: Retro-X, Synchilla unknown tail, Patagonia broad jacket tail, and Patagonia down tail comparable keys.
- `scannedParsedRows`: 250
- `candidateRows`: 159
- `reclassifyRows`: 57
- `refreshParsedRows`: 80
- `rejectRows`: 22

Representative decisions:
- `Patagonia synchilla 파타고니아 신칠라( M)` — Retro-X -> Synchilla
- `파타고니아 라이트웨이트 신칠라 3xl` — Retro-X -> Synchilla
- `파타고니아 레트로 플리스 자켓 집업 xs` — Retro-X -> Patagonia broad/internal
- `파타고니아 레트로 후리스 (gd착용)` — rejected
- `00s 나이키 다운 푸퍼 패딩 녹타 나이키코리아 파타고니아` — Patagonia down -> rejected

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 44 passed / 0 failed.
- `npx tsx scripts/run-market-stats-stage-once.ts`
  - `poolUpserted`: 1180
  - `reveal_current_profit_invalidated`: 1
- `npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --apply`
  - 1 stale shoe internal-only row invalidated; no clothing public blocked leakage.
- `npx tsx scripts/report-shoe-sku-safety.ts --category=clothing`
  - ready SKU: 47
  - `safe_public`: 39
  - `probably_safe`: 8
  - `fix_now`: 0
- `npx tsx scripts/report-shoe-sku-safety.ts --category=shoe`
  - ready SKU: 71
  - `safe_public`: 68
  - `probably_safe`: 3
  - `fix_now`: 0

## Deferred
- `clothing-patagonia-synchilla` remains `probably_safe` due historical feedback and sample-thin current ready rows.
- Further split candidates: Snap-T vs lightweight Synchilla vs hooded/microdini/variant rows. Hold public expansion until fresh raw rows show repeatable, dense patterns.

