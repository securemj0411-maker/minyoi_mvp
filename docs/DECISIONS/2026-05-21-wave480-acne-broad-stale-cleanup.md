# Wave 480 — Acne broad stale cleanup

Time: 2026-05-21 12:48 KST

## Context

After Acne apparel cleanup, `clothing-acne-broad` still contained seven active rows. Current parser results were safer than keeping these in broad.

## Decisions

1. Remove `clothing-acne-broad` active stale rows.
   - Current pants rows move to `clothing-acne-pants`.
   - Current cardigan/knit rows move to `clothing-acne-knit`.
   - The skirt row is cleared because no dedicated Acne skirt lane exists and broad is too imprecise.

2. Do not create an Acne skirt lane yet.
   - Single active stale row is not enough sample volume.

## Applied

- DB:
  - Migrated 4 active stale rows to `clothing-acne-pants`.
  - Migrated 2 active stale rows to `clothing-acne-knit`.
  - Cleared 1 active stale row from `clothing-acne-broad`.

## Verification

- Prior parser regression suite in this wave set:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 175 passed, 0 failed.
- `npx tsx scripts/wave480-acne-broad-stale-apply.ts`
  - post-apply `totalActions=0`, `scanned=0`, `holdCount=0`.

## Deferred

- Dedicated Acne skirt lane.
