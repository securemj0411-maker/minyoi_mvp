# 2026-05-25 Wave839 — Polo knit/Oxford brand and tail cleanup

## Context
- Safety report showed Polo knit and Oxford as `probably_safe`, but historical feedback and key tails remained.
- Fresh inspection found a real current false-positive:
  - `그레일즈 G SPORTS KNIT POLO ZIP UP 니트집업` was in `clothing-polo-knit-sweater` ready because `polo` was treated as Ralph Lauren.
- Dry-run also found `아미 옥스포드 폴로셔츠` still matching Polo Oxford.

## Decision
- Keep standard Polo Ralph Lauren knit/Oxford ready.
- Add blockers for newly observed other-brand garment-word cases:
  - Grailz / G Sports in Polo knit
  - AMI / Ami Paris in Polo Oxford
- Move or reject stale Polo knit/Oxford rows that represent:
  - other-brand polo knit wording
  - Lauren Ralph Lauren / girls / kids
  - big pony / multi-pony / special/vintage Oxford
  - short-sleeve Oxford
  - sneaker/product-type pollution

## Implemented
- Updated `src/lib/generated/catalog-712b-bias-free.ts` for Polo knit blockers.
- Updated `src/lib/catalog.ts` for Polo Oxford blockers.
- Added regression coverage in `tests/fashion-catalog-regression.test.ts`.
- Test suite passed: `41/41`.

## DB apply
- Applied current catalog reclassification with `--apply`.
- Result:
  - scannedParsedRows: 641
  - rawRows: 641
  - candidateRows: 111
  - reclassifyRows: 6
  - refreshParsedRows: 81
  - rejectRows: 24
- Important rejects:
  - `그레일즈 G SPORTS KNIT POLO ZIP UP 니트집업`
  - `아미 옥스포드 폴로셔츠`
  - Polo girls cardigan / boys Oxford
  - big-pony / multi-pony Oxford
  - short-sleeve Oxford
  - Oxford sneaker/product-type rows
- Important reclassifications:
  - Valid Ralph Lauren knit rows previously under broad -> `clothing-polo-knit-sweater`
  - Lauren Ralph Lauren / girls cardigan -> broad/internal or reject
  - vintage big Oxford -> `clothing-polo-oxford-vintage`

## Post-apply stage
- Ran market stats stage once.
- Result:
  - queued/enriched: 46
  - scored: 1111
  - poolUpserted: 963
  - reveal_current_profit_updated: 21
  - reveal_current_profit_invalidated: 4
- Gate cleanup with `--apply` invalidated one shoe internal-only stale row; no new clothing blocked public rows remained.

## Safety report after wave
- Clothing ready SKUs: 47
- `safe_public`: 37
- `probably_safe`: 10
- `fix_now`: 0
- `clothing-polo-knit-sweater` ready count moved from 8 to 7 because the Grailz false-positive was removed.
- Current ready examples for Polo knit/Oxford are now Ralph Lauren rows; report shows `currentOther=0`, `currentNull=0`.

## Tail check
- Additional Polo tail dry-run over knit `dress/vest/cardigan` and Oxford `shorts/jacket/polo_shirt` keys found no actionable candidates.

## Deferred
- Do not public-release broad Polo apparel.
- Future exact lanes may be considered only after clean sample evidence:
  - Lauren Ralph Lauren knit/cardigan
  - Polo short-sleeve Oxford
  - Polo Big Oxford / vintage Oxford variants beyond the existing vintage lane
