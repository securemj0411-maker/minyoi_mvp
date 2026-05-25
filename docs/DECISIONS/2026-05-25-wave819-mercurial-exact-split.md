# Wave 819 Nike Mercurial Exact Split

Date: 2026-05-25

## Context
- Continued shoe deep sweep on `shoe-nike-mercurial-broad`, one of the high-volume watch/internal-only buckets.
- Operator feedback and fresh raw samples showed broad Mercurial rows were mixing generation, tier, stud/sole type, Superfly, CTR360 bundle listings, and vintage Vapor models.

## Findings
- Safe deterministic split candidates were repeated and explicit:
  - Vapor 16 Elite FG
  - Vapor 16 Elite AG
  - Vapor 16 Elite TF
  - Vapor 16 Pro TF
  - Vapor 15 Pro TF
  - Vapor 14 Elite AG
  - Vapor 14 Pro TF
- Unsafe or deferred rows:
  - Superfly rows do not belong in Mercurial Vapor broad.
  - CTR360 bundle row is multi-model and should not be a comparable.
  - Vapor 1 / Vapor 3 vintage rows are a separate price axis and should not share broad Mercurial median.
  - Rows without generation or stud/sole axis stay broad/internal-only or rejected until repeatable exact evidence appears.

## Decisions / Changes
- Added 7 Nike Mercurial Vapor exact SKUs with lane keys.
- Marked those exact lanes as `ready`.
- Kept `shoe-nike-mercurial-broad` broad/internal-only.
- Added broad guards for Superfly, CTR360/Maestri, Vapor 1, and Vapor 3.
- Added regression coverage for exact model/sole matching and bad broad pollution.

## DB Mutations Applied
- Reclassified historical Mercurial broad parsed rows:
  - scanned parsed rows: 28
  - candidate rows: 27
  - reclassify rows: 21
  - reject rows: 6
  - reason: `wave819_mercurial_exact_split`
- One Superfly row moved from Mercurial broad to Superfly broad.
- 20 rows moved to exact Mercurial Vapor lanes.
- 6 rows were rejected by current catalog as non-comparable/bad broad samples.
- Market stats refresh after apply:
  - `timedOut=false`
  - `scored=475`
  - `poolUpserted=386`
  - `upserted=62`
  - `market_invalidation_claimed_shoe_keys=1`

## Verification
- Regression:
  - `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 24/24 passed.
- All-category current reparse cleanup dry-run:
  - `scannedPoolRows=525`
  - `candidateRows=0`
  - `invalidatePoolRows=0`
  - `reclassifyRows=0`
  - `rejectRows=0`
- Shoe SKU safety:
  - `catalogSku=633`
  - `nonEmptySku=488`
  - `readySku=72`
  - `safe_public=65`
  - `probably_safe=7`
  - `fix_now=0`
- Note: the new exact Mercurial SKUs are lane-ready, but current pool rows are not guaranteed until market median/profit scoring supports them.

## Deferred / Follow-Up
- Do not release `shoe-nike-mercurial-broad`.
- Review remaining Nike football broad lanes (`Tiempo`, `Superfly`) for exact generation/stud splits.
- Continue with Adidas Superstar broad and Nike Dunk broad where feedback already points to model/collab ambiguity.
