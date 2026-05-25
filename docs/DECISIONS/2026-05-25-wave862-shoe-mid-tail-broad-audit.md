# 2026-05-25 Wave862 shoe mid-tail broad audit

## Context
- Continued the shoe deep-sweep after Wave861.
- Targeted the next unprocessed mid-tail watch/internal-only shoe lanes:
  - `shoe-crocs-slipper-broad`
  - `shoe-nike-spiridon-broad`
  - `shoe-adidas-stansmith-broad`
  - `shoe-nike-shox-z-broad`
  - `shoe-onitsuka-broad`
  - `shoe-crocs-light-ride-broad`
  - `shoe-newbalance-1906r-broad`
  - `shoe-nike-airmax-98-broad`

## Decisions
- No new catalog matcher change was needed in this wave.
- Confirmed current global shoe broad gate still keeps `*-broad` shoe lanes internal-only even when old `LANE_READINESS` entries are still marked `ready`; these broad lanes are useful for raw learning but do not directly enter the public pool.
- Kept Adidas Stan Smith broad unreleased/public-blocked. Sample rows mix Winter Mid, Velcro, Human Made, Decon, and Bulk, so it should not be public-comparable without narrower child lanes.
- Kept Nike Spiridon broad unreleased/public-blocked. Current catalog already rejects Fragment Spiridon, and Stussy Spiridon has its own ready narrow lane.
- Kept Onitsuka broad unreleased/public-blocked except for already-audited exact `onitsuka_mexico_66`.

## Applied Result
- Reclassify dry-run and apply matched:
  - scanned parsed rows: 321
  - candidate rows: 23
  - reclassified rows: 0
  - refreshed rows: 22
  - rejected rows: 1
- Rejected row:
  - pid `401271066` — `나이키 x 프라그먼트 스피리돈 블랙 (290)` from `shoe-nike-spiridon-broad` to null.
- Market staging completed after apply:
  - queued: 28
  - enriched: 28
  - scored: 1500
  - upserted: 88
  - pool upserted: 1294
  - reveal current profit updated: 21
  - reveal current profit invalidated: 3
- Gate cleanup after staging first removed 1 stale shoe row, then a second cleanup confirmed 0 remaining candidates.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts` passed: 60/60.
- Latest shoe safety:
  - catalog SKU: 641
  - non-empty SKU: 503
  - ready SKU: 84
  - ready safe public: 81
  - ready probably safe: 3
  - fix-now: 0
- Latest clothing safety:
  - catalog SKU: 260
  - non-empty SKU: 248
  - ready SKU: 49
  - ready safe public: 41
  - ready probably safe: 8
  - fix-now: 0

## Deferred
- Stan Smith broad should eventually be split into at least plain, Decon, Human Made/collab, Winter Mid, and Velcro/Bulk axes before any public release.
- Spiridon broad should stay internal until Cage 2, OG, Fragment, and other collab axes are cleanly separated.
- Continue with the next unprocessed shoe watch/internal-only lanes, then apply the same audit flow to clothing broad lanes.
