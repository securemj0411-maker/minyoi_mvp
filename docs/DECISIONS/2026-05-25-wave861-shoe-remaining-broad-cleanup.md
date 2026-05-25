# 2026-05-25 Wave861 shoe remaining broad cleanup

## Context
- Continued the shoe deep-sweep after Wave860 without changing the recently restored pool gate behavior.
- Targeted the next broad/internal-only shoe lanes:
  - `shoe-adidas-gazelle-og-broad`
  - `shoe-hoka-broad`
  - `shoe-onrunning-cloudaway-broad`
  - `shoe-newbalance-1906l-broad`
  - `shoe-nike-airmax-270-broad`
  - `shoe-newbalance-1600-broad`
  - `shoe-timberland-broad`
  - `shoe-underarmour-broad`
  - `shoe-newbalance-1300-broad`
  - `shoe-newbalance-5740-broad`

## Decisions
- Disabled the legacy Adidas Gazelle OG broad lane by adding a direct self-blocker. Normal Gazelle rows now route to the existing ready `shoe-adidas-gazelle-broad` lane instead of remaining in an internal duplicate lane.
- Added Gazelle blockers for Farm/팜, Brazil World Cup, Mexico, and limited/special-code style rows so high-variance collab or country-edition products do not pollute the normal Gazelle public lane.
- Kept On Running Cloudaway routing narrow where explicit Cloudaway signals were present; one ambiguous `온 클라우드 어웨이 1` row remained on broad refresh because it still needs more raw pattern confidence before a narrower split.
- Preserved New Balance 1300/1600 exact lanes and confirmed Wave860 vintage blockers keep `U1500` and `1400JP` away from generic made-in fallback lanes.
- Rejected a Hoka broad false positive caused by a New Balance 725 title.

## Applied Result
- Reclassify dry-run and apply matched:
  - scanned parsed rows: 186
  - candidate rows: 49
  - reclassified rows: 23
  - refreshed rows: 18
  - rejected rows: 8
- Market staging completed after apply:
  - queued: 44
  - enriched: 44
  - scored: 1735
  - upserted: 152
  - pool upserted: 1417
  - reveal current profit updated: 21
  - reveal current profit invalidated: 5
- Gate cleanup after staging found 0 remaining candidates.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts` passed: 60/60.
- Latest shoe safety:
  - catalog SKU: 641
  - non-empty SKU: 503
  - ready SKU: 83
  - ready safe public: 81
  - ready probably safe: 2
  - fix-now: 0
- Latest clothing safety:
  - catalog SKU: 260
  - non-empty SKU: 248
  - ready SKU: 49
  - ready safe public: 41
  - ready probably safe: 8
  - fix-now: 0

## Deferred
- Large broad lanes such as New Balance 327, Gucci, Chuck70 High, Adidas Tobacco, Prada, Nike Shox, Dior/Hermes, and other already-swept broad lanes remain internal-only until they gain enough narrow evidence or are split into safer child SKUs.
- Clothing still has many high-volume broad lanes with zero ready rows. Next pass should use the same SKU-level audit method rather than brand-level assumptions.
