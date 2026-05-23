# 2026-05-21 Wave 437 - Supreme x TNF bag shape split

## Context

- Wave 436 exposed that `bag-tnf-supreme-backpack` was not a true backpack-only SKU.
- It also accepted `숄더백`, `토트백`, and `shoulder/tote` signals, so shoulder/tote rows shared the backpack comparable group.
- `clothing-tnf-supreme-collab` could still absorb TNF cap/goggle accessory rows.

## Decisions

- Narrow `bag-tnf-supreme-backpack` to explicit backpack signals only.
- Add separate bag SKUs:
  - `bag-tnf-supreme-shoulder`
  - `bag-tnf-supreme-tote`
  - `bag-tnf-supreme-waist`
- Add explicit blocks so TNF Supreme broad clothing does not absorb:
  - backpack / shoulder / tote / waist / lumbar bags
  - caps / panels / snapbacks
  - ski goggles
  - mule/slipper/sandal and G-Shock signals
- Keep existing TNF Supreme jacket narrow lanes active during sync so broad rows can promote to Nuptse/Mountain/Expedition/Baltoro/etc. rather than being cleared.

## DB sync

- Synced all Supreme x TNF target SKUs together to avoid partial-clearing narrow jacket rows.
- Main transitions:
  - `bag-tnf-supreme-backpack -> bag-tnf-supreme-shoulder`: 2
  - `bag-tnf-supreme-backpack -> bag-tnf-supreme-tote`: 1
  - `null -> bag-tnf-supreme-waist`: 2
  - cap/goggle rows moved to null
  - multiple old broad clothing rows promoted to existing TNF Supreme narrow jacket lanes
- Final verification:
  - `bag-tnf-supreme-backpack` count: 23, contaminated rows: 0
  - `bag-tnf-supreme-shoulder` count: 2, contaminated rows: 0
  - `bag-tnf-supreme-tote` count: 1, contaminated rows: 0
  - `bag-tnf-supreme-waist` count: 2, contaminated rows: 0
  - `clothing-tnf-supreme-collab` count: 90, bag/cap/goggle contamination: 0

## Deferred

- TNF Supreme jacket broad still has some `type_unknown` and mixed apparel rows. Later wave should split or review high-repeat lines such as S Logo fleece, tape seam, lettered/anorak, and set-up/pants.
- G-Shock is still represented as a legacy clothing-category SKU. This should become a watch/accessory category in a later schema/catalog cleanup.
- Backpack rows still share all TNF Supreme backpack models in one comparable group. A later wave can split Expedition/Steep Tech/RTG/Borealis/Fur/Hot Shot if sample sizes support it.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
