# 2026-05-25 Wave840 — RRL denim/pants/shirt tail resweep

## Context
- Prior RRL work split denim / pants / shirt axes, but safety report still showed old family keys:
  - denim with `pants` / `shirt` tails
  - pants with `jeans` / `shorts` tails
  - shirt with legacy broad `shirt_pants` keys
- Fresh dry-run also found an other-brand reference row:
  - `H bar C 오리지널 스티치 웨스턴 셔츠 HbarC RRL 더블알엘`

## Decision
- Keep ready RRL denim, pants, and shirt lanes public only where the current matcher confirms the narrow axis.
- Block H Bar C / HbarC reference wording from RRL shirt.
- Route clear RRL denim jackets to the denim-jacket lane, not denim jeans/pants.
- Reject limited-edition / special / ambiguous RRL rows rather than letting them contaminate general comparable samples.

## Implemented
- Updated `src/lib/catalog.ts`:
  - RRL shirt now rejects `H bar C` / `HbarC` reference wording.
- Added regression coverage in `tests/fashion-catalog-regression.test.ts`.
- Test suite passed: `42/42`.

## DB apply
- Applied current catalog reclassification with `--apply`.
- Result:
  - scannedParsedRows: 303
  - rawRows: 303
  - candidateRows: 89
  - reclassifyRows: 9
  - refreshParsedRows: 64
  - rejectRows: 16
- Important reclassifications:
  - RRL denim jacket / trucker / chore-coat wording -> `clothing-polo-rrl-denim-jacket`
  - RRL grizzly jacket -> `clothing-polo-rrl-grizzly-jacket`
  - legacy shirt-pants row with clear pattern/check shirt -> `clothing-polo-rrl-shirt`
- Important rejects:
  - limited-edition rigid selvedge / limited ecru five-pocket rows
  - patchwork field chino
  - H Bar C western shirt reference row
  - special workshirt / double-face / painted-tan workshirt rows
  - ambiguous row with no current catalog match

## Post-apply stage
- Ran market stats stage once.
- Result:
  - queued/enriched: 55
  - scored: 1893
  - poolUpserted: 1765
  - reveal_current_profit_updated: 9
  - reveal_current_profit_invalidated: 7
- Gate cleanup with `--apply` invalidated one stale shoe internal-only row; no new clothing blocked public rows remained.

## Safety report after wave
- Clothing ready SKUs: 47
- `safe_public`: 37
- `probably_safe`: 10
- `fix_now`: 0
- RRL shirt and pants are `safe_public`.
- RRL denim remains `probably_safe` because historical feedback exists, but current ready examples are jeans/denim pants and report shows `currentOther=0`, `currentNull=0`.

## Deferred
- Do not public-release RRL denim jacket yet; it has evidence but no ready rows after this pass.
- Future RRL exact lanes worth evaluating after more samples:
  - RRL denim shirt separate from jeans
  - RRL special workshirt / double-face / painted workshirt
  - RRL field/chore jacket variants
