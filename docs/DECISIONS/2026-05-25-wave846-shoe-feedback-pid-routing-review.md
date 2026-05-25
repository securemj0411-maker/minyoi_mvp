# 2026-05-25 Wave846 — Shoe Feedback PID Routing Review

## Context
- Shoe safety after Wave845:
  - ready SKU: 70
  - `safe_public`: 67
  - `probably_safe`: 3
  - `fix_now`: 0
- The remaining `probably_safe` shoe lanes were:
  - `shoe-hoka-mafate-satisfy-collab`
  - `shoe-vans-style-36`
  - `shoe-newbalance-casablanca-327-collab`
- Tail dry-run across these three lanes scanned 79 parsed rows and found 0 current-catalog changes.

## Decision
- Keep the 3 shoe `probably_safe` lanes public for now. They are current-clean but sample-thin / feedback-tainted.
- Review high-feedback shoe PIDs across broader internal/watch lanes before creating new SKU splits.
- Apply only deterministic stale-current updates from feedback PIDs.

## Apply Result
- Command: `apply-fashion-current-catalog-reclassify.ts --apply --pids=...`
- `scannedParsedRows`: 10
- `candidateRows`: 2
- `reclassifyRows`: 0
- `refreshParsedRows`: 1
- `rejectRows`: 1

Rows:
- `403733500` — `아디다스 가젤 블랙 도트 스니커즈 260mm`
  - `shoe-adidas-gazelle-og-broad` -> rejected
  - Reason: dot/special variant should not remain in the generic Gazelle broad comparison key.
- `409238712` — `아디다스 슈퍼스타 II 스톤카키 - 265 사이즈`
  - `shoe-adidas-superstar-broad` -> same SKU/key refresh
  - Reason: current catalog still treats Superstar II as broad/internal; split requires more sample evidence.

## Verification
- `npx tsx scripts/run-market-stats-stage-once.ts`
  - `queued`: 19
  - `poolUpserted`: 648
  - `reveal_current_profit_updated`: 2
  - `reveal_current_profit_invalidated`: 0
- `npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --apply`
  - 1 stale shoe internal-only row invalidated.
- `npx tsx scripts/report-shoe-sku-safety.ts --category=shoe`
  - ready SKU: 70
  - `safe_public`: 67
  - `probably_safe`: 3
  - `fix_now`: 0

## Deferred
- Superstar II vs Superstar 82 vs regular broad: keep internal/watch until enough raw rows show a dense, repeatable price axis.
- Asics Kayano Thom Browne, Dr. Martens Virginia/Pascal, and football silo/grade/ground splits remain future split candidates, but current public pool has no `fix_now`.

