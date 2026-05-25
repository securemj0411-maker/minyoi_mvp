# Wave831 BAPE hoodie/zip axis cleanup

Date: 2026-05-25

## Context

Clothing SKU safety still showed BAPE hoodie and zip hoodie in `probably_safe`.
Recent operator feedback and current samples showed that the public ready lanes could mix:

- non-zip hoodie vs "풀 집/풀집업" zip hoodie wording
- BAPE x New Balance jacket wording
- Starvape false brand wording
- knit/sweater rows
- Baby Milo sub-line rows

## Decision

Keep `bape_hoodie` and `bape_hoodie_zip` ready, but narrow the parser and block the observed leak paths.

- `clothing-bape-hoodie` now rejects Korean full-zip spacing tokens (`풀 집`, `풀 집업`) and jacket/New Balance wording.
- `clothing-bape-hoodie-zip` now accepts Korean full-zip spacing tokens and rejects New Balance, Starvape, knit/sweater wording.
- `clothing-bape-jacket-broad` now rejects New Balance wording too, so a blocked collab row cannot escape through the broad jacket side door.
- Regression coverage was added for full-zip wording, New Balance jacket leakage, Starvape false brand, and plain hoodie readiness.

## DB Backfill

Applied with `scripts/apply-fashion-current-catalog-reclassify.ts --apply`.

- scanned parsed rows: 139
- candidate rows: 43
- reclassified: 3
- refreshed parsed keys: 34
- rejected: 6

Representative changes:

- `408125992` and `407966767` moved from `clothing-bape-hoodie` to `clothing-bape-hoodie-zip`.
- `408019731` (`베이프 x 뉴발란스 후디 자켓 그레이`) rejected from the public hoodie lane.
- Starvape / Baby Milo / sweater contaminant rows rejected from the public lanes.

## Verification

- `npx tsx --test tests/fashion-catalog-regression.test.ts` passed: 36/36.
- `scripts/run-market-stats-stage-once.ts` completed and upserted 401 pool rows.
- `scripts/cleanup-fashion-pool-gate-blocked.ts --apply` found 0 gate-blocked ready rows.
- Clothing safety after cleanup:
  - ready SKUs: 47
  - safe_public: 37
  - probably_safe: 10
  - fix_now: 0

## Deferred

`bape_hoodie_zip` still appears in `probably_safe` because historical feedback remains attached, but current contamination counters are clean. Leave it ready and continue monitoring rather than demoting it.
