# Wave832 Stussy half-zip and special-axis cleanup

Date: 2026-05-25

## Context

Clothing safety still showed Stussy hoodie and zip hoodie in `probably_safe`.
Operator feedback pointed to public comparison rows mixing pullover hoodies, zip hoodies, and half-zip/crewneck sweatshirts.

Current dry-run also found ready lanes polluted by:

- Seoul Stock limited hood / zip hoodie
- pigment-dyed crewneck / hoodie wording
- half-zip sweatshirt wording
- 8 Ball sweatshirt wording
- basic zip hoodie rows stored under pullover hoodie

## Decision

Keep Stussy pullover hoodie, basic zip hoodie, and basic crewneck ready, but block special axes from those public lanes.

- Stussy hoodie now rejects half-zip/quarter-zip wording.
- Stussy crewneck/sweat now rejects half-zip/quarter-zip and 8 Ball wording.
- Direct Stussy axis fallback now treats half-zip wording as a special/non-public axis instead of allowing generic crewneck fallback.
- Existing special lanes such as `stussy_8ball_hoodie` remain matchable.

## DB Backfill

Applied with `scripts/apply-fashion-current-catalog-reclassify.ts --apply`.

- scanned parsed rows: 339
- candidate rows: 23
- reclassified: 3
- refreshed parsed keys: 0
- rejected: 20

Representative changes:

- Basic zip hoodies (`369159851`, `409961032`, `401216630`) moved from pullover hoodie to `clothing-stussy-zip-hoodie`.
- Seoul Stock / pigment / half-zip / 8 Ball sweatshirt rows were rejected from public comparison lanes.

## Verification

- Direct checks:
  - `스투시 8볼 맨투맨 xl` -> null
  - `[S]스투시 반집업 맨투맨` -> null
  - `스투시 후드집업 블랙 L` -> `clothing-stussy-zip-hoodie`
  - `스투시 크루넥 맨투맨 그린` -> `clothing-stussy-crewneck-sweat`
  - `스투시 8볼 후드티 블랙` -> `clothing-stussy-8ball-hoodie`
- `npx tsx --test tests/fashion-catalog-regression.test.ts` passed: 36/36.
- `scripts/run-market-stats-stage-once.ts` completed and upserted 1111 pool rows.
- `scripts/cleanup-fashion-pool-gate-blocked.ts --apply` found 0 gate-blocked ready rows.

## Deferred

Stussy hoodie/zip still appear in `probably_safe` because historical feedback is retained in the report, but current contamination counters are clean (`currentOther=0`, `currentNull=0`). Continue monitoring rather than demoting the ready lanes.
