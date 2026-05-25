# 2026-05-25 Wave837 — Lacoste pique tail-key cleanup

## Context
- `clothing-lacoste-pique-polo` had only one current ready row and no deterministic current pollution.
- Safety report still showed historical feedback and stale non-polo product keys under the same SKU:
  - generic `tee`
  - `long_sleeve_tee`
  - `crewneck`
  - `knit`
- These rows can pollute comparison samples if left under the pique comparable family.

## Decision
- Keep the exact short-sleeve pique/polo lane ready.
- Move generic tee, graphic/collab tee, knit collar tee, and long-sleeve polo/pique rows to `clothing-lacoste-broad`.
- Do not create a public Lacoste long-sleeve SKU yet. Current evidence is too thin and mostly stale; it should remain internal-only until a narrow lane has enough clean samples.

## Implemented / DB apply
- First apply:
  - scannedParsedRows: 130
  - rawRows: 130
  - candidateRows: 17
  - reclassifyRows: 10
  - refreshParsedRows: 7
  - rejectRows: 0
- Examples moved out of pique:
  - `라코스테 남성 반팔 티셔츠 100`
  - `LACOSTE 21SS 라코스테 릴랙스핏 그래픽 티셔츠`
  - `라코스테 화이트 긴팔 폴로셔츠`
  - `라코스테 피케티셔츠 pk티셔츠 긴팔 여성`
- Tail-key apply:
  - scannedParsedRows: 125
  - rawRows: 125
  - candidateRows: 2
  - reclassifyRows: 2
  - refreshParsedRows: 0
  - rejectRows: 0
- Tail examples moved out of pique:
  - `라코스테 넷플릭스 콜라보 티셔츠`
  - `택포) 라코스테 니트 카라티셔츠 3`

## Post-apply stage
- Ran market stats stage after each apply.
- Latest stage result:
  - queued/enriched: 13
  - scored: 594
  - poolUpserted: 469
  - reveal_current_profit_updated: 1
  - reveal_current_profit_invalidated: 0
- Gate cleanup after apply found no additional blocked public rows.

## Safety report after wave
- Clothing ready SKUs: 47
- `safe_public`: 37
- `probably_safe`: 10
- `fix_now`: 0
- `clothing-lacoste-pique-polo` remains `probably_safe` because of historical feedback and low ready count, not because of current deterministic pollution.

## Deferred
- Revisit Lacoste long-sleeve / knit collar / graphic tee as separate internal candidates if new raw flow provides enough clean samples.
- Keep `clothing-lacoste-broad` internal-only.
