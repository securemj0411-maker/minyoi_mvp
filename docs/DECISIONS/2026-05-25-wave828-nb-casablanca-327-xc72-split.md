# Wave 828 — NB Casablanca 327 / XC-72 split

## Context
- `shoe-newbalance-casablanca-collab` was marked ready as `NB x Casablanca (327)`.
- Raw sweep showed it was not one model:
  - 327 rows
  - XC-72 rows
  - model-missing `카사블랑카 콜라보` rows
  - a stray `뉴발란스237 카사블랑카`
- This could pollute sample comparison because 327 and XC-72 are different models.

## Decision
- Split Casablanca into exact public lanes:
  - `shoe-newbalance-casablanca-327-collab` / `nb_casablanca_327`
  - `shoe-newbalance-casablanca-xc72-collab` / `nb_casablanca_xc72`
- Move the old model-missing broad Casablanca lane to `internal_only`.
- Block `카사블랑카/casablanca` from NB 237 broad so it does not absorb stray Casablanca wording.
- Do not create a public model-missing Casablanca lane.

## Applied
- Reclassified 31 rows:
  - 327 rows -> `shoe-newbalance-casablanca-327-collab`
  - XC-72 rows -> `shoe-newbalance-casablanca-xc72-collab`
- Rejected 4 rows:
  - model-missing Casablanca broad rows
  - `뉴발란스237 카사블랑카`
- The previous ready row `227887253` moved from broad Casablanca to exact 327.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts` passed: 33/33.
- `cleanup-fashion-pool-gate-blocked` dry-run: 0 candidates.
- `apply-cross-category-current-reparse-cleanup` dry-run: 0 candidates.
- `run-market-stats-stage-once --limit=800` completed.
- `report-shoe-sku-safety --category=shoe`:
  - ready SKU: 69
  - safe_public: 67
  - probably_safe: 2
  - fix_now: 0

## Deferred
- Old `shoe-newbalance-casablanca-collab` remains only as internal catch-up/history, not public-ready.
