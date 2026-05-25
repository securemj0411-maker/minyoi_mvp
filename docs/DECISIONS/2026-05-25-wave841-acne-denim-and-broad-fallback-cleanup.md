# 2026-05-25 Wave841 — Acne denim and broad fallback cleanup

## Context
- `clothing-acne-denim` remained `probably_safe` due historical feedback and tail keys.
- Fresh sweep showed named denim fits and a kids multi-brand set could still leak through Acne generic/broad logic.
- Risk examples:
  - River / Rodeo / Max / 2021M named denim rows under generic Acne denim
  - `120-130 DKNY, 미니로디니, 아크네스튜디오 세트` trying to route into Acne shorts or Acne broad fallback

## Decision
- Keep generic Acne denim ready only for generic jeans/denim rows.
- Named or premium denim fit rows should route to existing narrow lanes or be rejected until proven.
- Kids/multi-brand set wording must not enter Acne shorts or Acne broad ready lanes.

## Implemented
- Updated `src/lib/catalog.ts`:
  - Acne shorts blocks kids/multi-brand set wording.
  - Acne apparel broad blocks the same wording.
- Updated `src/lib/generated/catalog-734-mega-brand.ts`:
  - Acne Studios broad blocks kids/multi-brand set wording.
- Added regression coverage in `tests/fashion-catalog-regression.test.ts`.
- Test suite passed: `43/43` after Acne changes.

## DB apply
- Applied current catalog reclassification with `--apply`.
- Result:
  - scannedParsedRows: 171
  - rawRows: 171
  - candidateRows: 41
  - reclassifyRows: 3
  - refreshParsedRows: 29
  - rejectRows: 9
- Important reclassifications:
  - `2021m 플레어진` -> Acne denim premium
  - `아크네 스튜디오 리버 데님 팬츠31` -> Acne Bla Konst denim
  - `아크네 리버진 33사이즈` -> Acne denim premium
- Important rejects:
  - River generic denim rows
  - 1995 Rodeo row
  - Max/Mannray row
  - jeans bundle row
  - DKNY/Mini Rodini kids set row

## Post-apply stage
- Ran market stats stage once.
- Result:
  - queued/enriched: 61
  - scored: 1694
  - poolUpserted: 1599
  - reveal_current_profit_updated: 9
  - reveal_current_profit_invalidated: 3
- Gate cleanup with `--apply` invalidated one stale shoe internal-only row; no new clothing blocked public rows remained.

## Deferred
- Do not add public 1981/1996 Acne denim model lanes yet. They need a separate sample comparison before release.
- If 1981/1996 rows keep appearing and show price separation, create explicit narrow lanes or hold them internal-only.
