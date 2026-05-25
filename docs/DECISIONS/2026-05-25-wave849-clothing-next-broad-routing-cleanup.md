# Wave 849 — Clothing next broad current-routing cleanup

## Context

After the top broad clothing families were cleaned in wave 848, the next largest stale clothing broad families still had many eligible rows but no public readiness proof. This wave reviewed current rows for:

- Comme des Garcons / CDG
- Supreme
- Stussy
- Champion
- Levi's

The goal was not to publish broad lanes. It was to pull deterministic rows into narrower audited lanes, reject obvious other-brand/reference bait, and keep ambiguous broad rows internal.

## Decisions

1. Keep the broad lanes internal/watch-only.
   - CDG, Supreme, Stussy, Champion, and Levi's broad rows still mix too many product axes for public-ready release.
2. Reclassify only where current catalog routing is explicit.
   - Supreme box logo rows moved to the box logo lane.
   - Supreme collab rows moved to the Supreme collab broad lane.
   - Stussy x Nike rows moved to the Stussy Nike collab lane.
   - Champion Reverse Weave rows moved to the Reverse Weave lane.
   - CDG Homme rows moved out of generic CDG broad.
3. Reject reference-bait / unsafe cross-brand rows instead of keeping them comparable.
   - Examples included Supreme x Champion/Vanson/special model rows, Stussy rows mentioning other collabs, Champion Darkroom, Coach x Champion, and description-only `꼼데 맛`.
4. Tighten catalog guards found during dry-run before applying.
   - `clothing-uniqlo-broad` now blocks Champion/Coach/leather-jacket reference rows after a Coach x Champion leather jacket was pulled by description-only Uniqlo sizing text.
   - `clothing-stussy-basic-tee` blocks knit/sweater terms.
   - `clothing-stussy-8ball-knit` accepts Korean `에잇볼` so `스투시 모헤어 에잇볼 니트` stays in the exact knit lane.

## Applied DB routing

Wave 849 apply:

- scannedParsedRows: 302
- rawRows: 302
- candidateRows: 90
- reclassifyRows: 22
- refreshParsedRows: 50
- rejectRows: 18

Notable routing:

- Supreme broad -> Supreme Box Logo
- Supreme broad -> Supreme collab broad
- Stussy broad -> Stussy Nike collab
- Champion broad -> Champion Reverse Weave
- CDG broad -> CDG Homme broad
- Unsafe special/collab/reference rows -> null reject

## Verification

- Regression: `npx tsx --test tests/fashion-catalog-regression.test.ts` passed 48/48.
- Stage after apply:
  - queued: 36
  - poolUpserted: 1608
  - reveal_current_profit_updated: 25
  - reveal_current_profit_invalidated: 2
- Gate cleanup:
  - clothing blocked-public residual: 0
  - shoe internal-only residual: 3
- Safety:
  - clothing readySku 46, safe_public 38, probably_safe 8, fix_now 0
  - shoe readySku 73, safe_public 70, probably_safe 3, fix_now 0

## Deferred

- Supreme special models/collabs beyond known safe lanes remain deferred instead of being folded into a public broad SKU.
- Stussy non-Nike collabs and outerwear subtypes remain broad/internal unless a clean exact axis is proven.
- Champion non-Reverse-Weave collaborations remain internal/null until enough raw patterns prove a deterministic product lane.
- Levi's broad remained mostly refreshed only; model-specific denim splits need separate evidence before any public release.
