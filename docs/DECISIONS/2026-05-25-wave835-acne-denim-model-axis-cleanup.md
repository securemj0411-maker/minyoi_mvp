# Wave835 Acne denim model-axis cleanup

Date: 2026-05-25

## Context

Clothing safety kept `acne_denim` in `probably_safe` with operator feedback showing model-axis mixing:

- River denim
- Max STR denim
- 1995 Rodeo denim
- generic Acne jeans

## Decision

Keep generic `acne_denim` ready for plain Acne jeans, but block named model axes from generic denim and broad apparel.

- `acne_denim` now rejects `river`, `rodeo`, `1995`, and already-separated model axes like Max / Bla Konst / Super Baggy / premium 2021M.
- `acne_studios_broad` now rejects denim terms and named denim fits so denim rows cannot leak through broad apparel after being blocked from generic denim.
- `acne_max_denim` remains matchable but non-public because there is no ready lane for it yet.

## DB Backfill

No DB write was needed for this wave.

- Dry-run across Acne denim/Max/premium/shorts and Acne broad denim/pants keys found 0 current candidates after the catalog change.
- A direct DB check found only one current `acne_studios_broad` parsed key (`skirt|c_grade`), not denim/pants.

## Verification

- Direct checks:
  - `River 데님` -> null
  - `1995 로데오 데님` -> null
  - `맥스 STR 로우 데님` -> `clothing-acne-max-denim`, blocked from public pool
  - plain `아크네스튜디오 청바지` -> `clothing-acne-denim`
  - `2021M 데님` -> `clothing-acne-denim-premium`
- `npx tsx --test tests/fashion-catalog-regression.test.ts` passed: 38/38.

## Deferred

River / Rodeo / 1995 should become explicit internal-only or ready model lanes only after more clean samples arrive. For now they are intentionally held out of public comparison.
