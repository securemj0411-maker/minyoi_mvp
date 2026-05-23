# Wave 478 — Acne apparel broad cleanup

Time: 2026-05-21 12:42 KST

## Context

After the Acne shirt/sweatshirt split, `clothing-acne-apparel` still contained stale broad rows that now had safer current outcomes:

- Caps
- Long-sleeve tees
- Forba / sweatshirt
- Scarves and unclear bundle rows that should not remain in broad apparel

One root parser issue appeared while reviewing these rows: `크루넥 긴팔 티셔츠` was conflicting between sweat and tee because `크루넥` is also a sweatshirt signal. This created null drift instead of routing to tee.

## Decisions

1. Let explicit long-sleeve tee wording win over generic crewneck wording.
   - Added spaced long-sleeve tee forms such as `긴팔 티셔츠`, `긴팔티셔츠`, and `롱슬리브 티셔츠` to `clothing-acne-tee`.
   - Blocked long/short tee terms from `clothing-acne-sweat` without blocking valid `스웻 티셔츠` wording.

2. Move stale broad rows to current Acne lanes where safe.
   - Cap rows move to `clothing-acne-cap`.
   - Long-sleeve / half-zip tee rows move to `clothing-acne-tee`.
   - Forba row moves to `clothing-acne-sweat`.

3. Clear non-comparable broad rows.
   - Scarves/mufflers and unclear bundle/damaged-size rows are not useful broad apparel comparables.

## Applied

- Parser/catalog: tightened Acne tee vs sweat routing.
- Tests: added Acne long-sleeve tee and half-zip tee regression samples.
- DB:
  - Migrated 1 active stale row to `clothing-acne-cap`.
  - Migrated 2 active stale rows to `clothing-acne-tee`.
  - Migrated 1 active stale row to `clothing-acne-sweat`.
  - Cleared 6 active stale rows from `clothing-acne-apparel`.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 175 passed, 0 failed.
- `npx tsx scripts/wave478-acne-apparel-stale-apply.ts`
  - post-apply `totalActions=0`, `holdCount=0`.

## Deferred

- Dedicated Acne scarf/accessory lanes are intentionally deferred.
- More granular Acne tee/half-zip tee lanes are deferred until clean repeated sample volume exists.
