# Wave 855 — Shoe mid broad routing cleanup

## Context

After wave 854, shoe safety was clean (`fix_now: 0`) but many high-volume broad shoe lanes remained in `watch_internal_only`. This wave reviewed a mid-risk batch to find stale public/pool rows that current catalog rules could now split, reject, or refresh:

- `shoe-nike-moonracer-broad`
- `shoe-converse-onestar-broad`
- `shoe-nike-dunk-low-broad`
- `shoe-balenciaga-track-broad`
- `shoe-converse-jack-purcell-broad`
- `shoe-nike-airmax-plus-tn-broad`
- `shoe-nike-airmax-dn-broad`
- `shoe-converse-chuck70-low-broad`
- `shoe-nike-shox-ride-2-broad`
- `shoe-balenciaga-runner-broad`

## Decisions

1. Keep normal Moonracer, One Star, Balenciaga Track, Jack Purcell, Air Max Plus TN, Air Max DN, Chuck 70 Low, Shox Ride 2, and Balenciaga Runner rows on their existing comparable lanes when current rules still agree.
2. Reclassify explicit Travis Scott Dunk Low wording from generic Dunk Low broad into `shoe-nike-dunk-low-travis-scott`.
3. Reject special Dunk Low axes from the generic broad lane when they are not safe general comparisons: Quartersnacks SB, Next Nature Sun Club, SP Plum, Retro Premium, and Premium W.
4. Reject Air Max Plus TN golf-shoe rows from the sneaker broad lane. This prevents golf category pricing from polluting regular Air Max Plus TN samples.
5. Treat `OX로우` and `OX 로우` as explicit Chuck 70 low wording, not ambiguous Chuck 70 wording.

## Code changes

- Added Chuck 70 low handling for `OX로우` / `OX 로우` and blocked those phrases from the ambiguous Chuck 70 lane.
- Added Air Max Plus TN blockers for golf-shoe wording.
- Added regression coverage for both cases.

## Applied DB routing

Wave 855 apply:

- scannedParsedRows: 622
- rawRows: 622
- candidateRows: 79
- reclassifyRows: 1
- refreshParsedRows: 72
- rejectRows: 6

Notable rows:

- pid `391125807`: `나이키 스캇 덩크로우` -> `shoe-nike-dunk-low-travis-scott`
- pid `258683437`: Quartersnacks SB Dunk Low -> null/review
- pid `228978484`: Dunk Low Next Nature Sun Club -> null/review
- pid `364954140`: Dunk Low SP Plum 2024 -> null/review
- pid `193309915`: Dunk Low Retro Premium -> null/review
- pid `299306211`: Dunk Low Premium W -> null/review
- pid `7000123378196`: Air Max Plus TN golf shoe -> null/review

## Verification

- Regression: `npx tsx --test tests/fashion-catalog-regression.test.ts` passed 53/53.
- Stage after apply:
  - queued: 85
  - poolUpserted: 1560
  - reveal_current_profit_updated: 28
  - reveal_current_profit_invalidated: 6
- Gate cleanup:
  - candidateRows: 2
  - applied shoe rows: 2
- Final safety:
  - shoe readySku 81, safe_public 79, probably_safe 2, fix_now 0
  - clothing readySku 46, safe_public 38, probably_safe 8, fix_now 0

## Deferred

- Do not promote the reviewed broad lanes solely from this wave. They remain subject to the safety report's `watch_internal_only` judgment until enough comparable sample quality is proven.
- Continue the shoe sweep with the next broad-risk batch from the safety report instead of stopping at this clean wave.
