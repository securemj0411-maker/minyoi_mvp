# Wave 882 - All-category current sample cleanup

## Context

- User asked to keep sweeping all categories without focusing on one token/brand.
- Priority remained fashion/shoe sample pollution, but the sweep also covered golf/game/lego and other categories in the latest 20k parsed rows.
- Goal was not just to undo a few bad rows, but to align current catalog behavior, stored raw SKU, parsed comparable keys, and market invalidation so newly entering raws and existing samples use the same rules.

## Decisions

- Treat current catalog rejection as stronger than legacy raw SKU fallback for sample safety.
- Keep active pool conservative: if current catalog no longer accepts an item, remove its comparable key instead of preserving legacy SKU.
- Drain both visible/actionable drift and quiet sample drift:
  - First pass handled explicit cross-category/actionable rows.
  - Second pass handled desired current-key drift where stored parsed key or raw SKU lagged current ruleMatch.
- Do not create broad new public SKUs for actual LEGO block sets under the game-title lane. Existing LEGO block rows that were sitting inside `switch-game-lego` were removed from game samples until a proper LEGO catalog sweep is done.

## Code Changes

- `catalog-760-game-titles.ts`
  - Broadened game-title noise for goods/accessories: 굿즈, 볼캡/모자/cap, 타올/타월, 제일복권, 라스트원, 굿스마일, 피그마/figma, 넨도로이드.
  - Tightened `switch-game-lego` so LEGO game title matching requires game/platform signals (`게임`, `게임칩`, `타이틀`, `스위치`, `닌텐도`, `switch`, `ps4`, `ps5`, etc.).
- `report-cross-category-db-deep-sweep.ts`
  - Reduced diagnostic false positives for clothing/shoe wording that overlaps golf terms:
    - 프리마로프트/하이로프트/라바 로프트, 웨지 스트레이트, 유틸리티 블랙, 하이브리드 후디/다운볼/하이탑, 유벤투스, 닌텐도64, 제로퍼터.
  - Ignored fashion tier/json mismatch and category-conflict diagnostics on `needs_review=true` rows.
- `fashion-catalog-regression.test.ts`
  - Added regression tests for Cyberpunk goods rejection and LEGO block-vs-game separation.

## DB Actions

- Initial 20k cross-category sweep after prior fixes:
  - `actionableRows=128`, `poolActionableRows=0`.
- Applied actionable cleanup:
  - Parsed current reparse upsert: 125 rows.
  - Current catalog rejects: 3 rows (`조던 모자`, `사이버펑크 볼캡`, `RRL 볼캡`).
  - Market invalidations queued: 104.
- LEGO game-block cleanup:
  - `switch-game-lego` scanned: 70.
  - Actual LEGO block/figure/set rows rejected from game samples: 67.
  - Market invalidations queued: 1 key.
- Desired current-key drift cleanup:
  - Raw-key drift candidates: 1213.
  - Parsed key updated: 833.
  - Raw SKU only synchronized: 347.
  - Current catalog rejects removed from samples: 17.
  - Dirty marked: 1166 rows.
  - Market invalidations queued: 1006.
- Tail cleanup:
  - Residual tier-column mismatch fixed: 5 rows.
  - Remaining Cyberpunk goods rejected: 15 rows.
  - Market invalidations queued: 20.

## Verification

- Regression test:
  - `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - Result: 81/81 passed.
- Final 20k all-category sweep:
  - `auditedRows=20000`
  - `flaggedRows=67`
  - `actionableRows=0`
  - `poolRowsReadyOrReserved=67`
  - `poolActionableRows=0`
  - Remaining flags are non-actionable raw-reparse drift diagnostics or one current condition-class change.
- Market stats stage was run three times:
  - Claimed invalidation keys: 500 + 500 + 86.
  - Pool upserted: 1991 + 2756 + 924.
- Current pool snapshot after market drain:
  - Total pool rows fetched: 6665.
  - ready: 538, invalidated: 6106, spent: 21.
  - ready by category: shoe 169, clothing 146, earphone 59, smartphone 34, tablet 33, smartwatch 29, drone 20, sport_golf 9, game_console 4.

## Deferred / Risks

- Score-stage dirty drain needed a separate hotpath follow-up after this cleanup:
  - First run used the default 90s budget due wrong argument name and timed out.
  - Second run with `--budget-ms=180000` still timed out before scoring.
  - Non-fatal timeouts observed in `loadFraudGroupHashes` and `loadLowVolumeSkuIds`.
  - Follow-up on 2026-05-26 is logged in `2026-05-26-wave883-score-hotpath-and-handoff.md`.
- `score_dirty` is globally high (`>=20000` fetched cap), especially shoe/clothing/bag. This is a separate runtime backlog and should be fixed without rolling back parser/catalog cleanup.
- LEGO physical set support is deferred. Current decision only prevents LEGO block/set rows from polluting game-title samples.
