# Wave 860 — Shoe NB / Crocs / Clarks cleanup

## Context

After wave 859, the remaining `watch_internal_only` shoe list moved into smaller New Balance vintage/model families plus Crocs/Clarks and a Superfly residual. This wave reviewed:

- `shoe-newbalance-1500-broad`
- `shoe-nike-superfly-broad`
- `shoe-newbalance-1400-broad`
- `shoe-newbalance-996-broad`
- `shoe-crocs-boots-broad`
- `shoe-newbalance-509-broad`
- `shoe-clarks-broad`
- `shoe-newbalance-237-broad`
- `shoe-newbalance-990v6`
- `shoe-newbalance-2002-broad`

## Decisions

1. Fix New Balance generic fallback ambiguity. Generic NB broad was still matching 1400/1500/990v6-class rows alongside exact lanes, causing normal listings to fall to null.
2. Keep 1400/1500 Made in USA/UK rows on their exact model lanes, not the wider NB Made in USA/UK lane.
3. Add a proper `newbalance_990v6` laneKey/readiness to the legacy 990v6 exact lane so plain 990v6 rows can enter through the exact model, while Action Bronson stays blocked.
4. Reclass residual `Air Superfly` lifestyle rows out of the Mercurial/Superfly football broad.
5. Reclass Jordan Super.Fly 4 basketball wording out of football Superfly broad.
6. Reclass obvious New Balance collab/model axes out of broad:
   - 1400 J.Crew rows
   - 2002 JJJJound/Warm Alpaca row
7. Keep Crocs Boots, NB509, NB237, NB996, and plain NB2002 broad refreshes unchanged in this pass; no deterministic pollution surfaced in the bounded current-key sample.

## Code changes

- Added exact-model blockers to `shoe-newbalance-generic-broad` for 509, 991, 992, 1300, 1400, 1500, and 1600 families.
- Added exact-model blockers to `shoe-newbalance-made-in-usa-uk` so 1400/1500/991/992/1300/1600 go to their model lanes.
- Added `laneKey: "newbalance_990v6"` and readiness row for `shoe-newbalance-990v6`.
- Added Action Bronson blockers to the 990v6 exact lane.
- Added regression coverage for NB vintage exact lanes beating generic/made-in fallbacks.

## Applied DB routing

Wave 860 batch apply:

- scannedParsedRows: 185
- rawRows: 185
- candidateRows: 48
- reclassifyRows: 6
- refreshParsedRows: 41
- rejectRows: 1

Notable rows:

- `shoe-nike-superfly-broad` -> `shoe-nike-air-superfly`: pids `398513944`, `7002524536382`
- `shoe-nike-superfly-broad` -> `shoe-nike-airjordan-4`: pid `366600663`
- `shoe-newbalance-1400-broad` -> `shoe-newbalance-jcrew-collab`: pids `216026935`, `256412722`
- `shoe-newbalance-2002-broad` -> `shoe-newbalance-jjjjound-collab`: pid `222464691`
- `shoe-newbalance-990v6` -> null/review: Action Bronson 990v6 row
- Plain NB1500/NB1400/NB990v6 rows stayed on their exact model lanes after fallback fixes.

## Verification

- Regression: `npx tsx --test tests/fashion-catalog-regression.test.ts` passed 59/59.
- Stage after apply:
  - queued: 131
  - poolUpserted: 1656
  - reveal_current_profit_updated: 1
  - reveal_current_profit_invalidated: 0
- Gate cleanup:
  - first pass candidateRows: 1, applied shoe rows: 1
  - final pass candidateRows: 0
- Final safety:
  - shoe readySku 84, safe_public 81, probably_safe 3, fix_now 0
  - clothing readySku 49, safe_public 41, probably_safe 8, fix_now 0

## Deferred

- Clarks broad did not surface deterministic candidates in this bounded sweep, but should remain internal watch until Wallabee/Desert/Trek/Loafer axes are proven separately.
- Continue remaining shoe watch sweep with Adidas Gazelle/Hoka/On Running/NB1906L/Air Max 270/NB1600/Timberland/Under Armour/NB1300/NB5740 and then lower-sample exact lanes.
