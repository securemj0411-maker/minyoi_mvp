# 2026-05-25 Wave838 — Stussy direct-axis and tail-key cleanup

## Context
- `clothing-stussy-hoodie` and `clothing-stussy-zip-hoodie` were already cleaner after Wave832, but the safety report still showed historical feedback and stale family keys.
- A fresh dry-run exposed that direct matching could still route special or non-basic Stussy rows into basic hoodie/zip lanes before catalog blockers ran.
- Risky examples:
  - `스투시 x 유니온 후드`
  - `스투시 Soul 1980 후드티`
  - `스투시 청키 니트 후드집업`
  - `스투시 ... 후드자켓`
  - `스투시 ... 스웨터 스웻셔츠`

## Decision
- Basic Stussy hoodie remains ready only for plain pullover hoodie wording.
- Basic Stussy zip hoodie remains ready only for plain full-zip hoodie wording.
- Special/collab/product axes should not enter public basic hoodie/zip samples:
  - Union
  - Soul 1980
  - World Tour / Stock Seoul / Dice / 8-ball / pigment and existing special axes
  - hooded jacket
  - knit/sweater hoodie or zip hoodie
- Knit/sweater crewneck-like rows are not public crewneck until a narrow lane is separately proven.

## Implemented
- Updated `src/lib/catalog.ts` direct Stussy special-axis handling.
- Added catalog blockers to `clothing-stussy-hoodie`.
- Updated `src/lib/generated/catalog-805-fashion-axis-splits.ts`:
  - Stussy crewneck rejects knit/sweater.
  - Stussy zip hoodie rejects knit/sweater and Union.
- Added regression coverage in `tests/fashion-catalog-regression.test.ts`.
- Test suite passed: `40/40`.

## DB apply
- Main Stussy family apply:
  - scannedParsedRows: 376
  - rawRows: 376
  - candidateRows: 29
  - reclassifyRows: 9
  - refreshParsedRows: 9
  - rejectRows: 11
- Examples rejected from public basic lanes:
  - `스투시 다이스 후드 블랙`
  - `스투시 Soul 1980 후드티`
  - `스투시 월드투어 후드 그린 XL`
  - `스투시 x 유니온 후드 M`
  - `스투시 8볼 페이드 후드 화이트`
  - `새상품 스투시 스탁 서울 후드 집업 애쉬 헤더 L`
- Examples reclassified out of basic hoodie:
  - hooded jackets -> `clothing-stussy-apparel-broad`
  - knit hood / knit zip -> `clothing-stussy-apparel-broad`
  - plain zip hoodie previously under hoodie -> `clothing-stussy-zip-hoodie`

## Tail-key apply
- Additional family tail pass:
  - scannedParsedRows: 3
  - rawRows: 3
  - candidateRows: 2
  - reclassifyRows: 2
  - refreshParsedRows: 0
  - rejectRows: 0
- Examples:
  - fleece-collar sweatshirt row moved to crewneck.
  - stripe knit row moved to broad/internal.

## Post-apply stage
- Ran market stats stage after each apply.
- Latest stage result:
  - queued/enriched: 3
  - scored: 224
  - poolUpserted: 173
  - reveal_current_profit_updated: 5
  - reveal_current_profit_invalidated: 5
- Gate cleanup after apply found no additional blocked public rows.

## Safety report after wave
- Clothing ready SKUs: 47
- `safe_public`: 37
- `probably_safe`: 10
- `fix_now`: 0
- `clothing-stussy-zip-hoodie` now only reports `stussy_zip_hoodie|hoodie_zip` keys.
- `clothing-stussy-hoodie` still remains `probably_safe` due historical feedback, but current ready examples are plain hoodies and report shows `currentOther=0`, `currentNull=0`.

## Deferred
- Do not public-release Stussy broad apparel.
- Possible future narrow lanes if raw flow proves enough clean samples:
  - Stussy Union hoodie
  - Stussy knit hoodie / knit zip
  - Stussy hooded jacket / work jacket
