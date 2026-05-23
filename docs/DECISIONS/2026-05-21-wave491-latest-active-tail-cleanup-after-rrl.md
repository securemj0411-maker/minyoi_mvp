# 2026-05-21 Wave 491 — Latest active tail cleanup after RRL

## Context
- After Wave 490, reran the latest active fashion/shoe/bag sweep.
- Remaining rows were small stale pockets exposed after RRL cleanup.

## Decisions
- Route RRL waffle/knit henley tee wording to `clothing-polo-rrl-knit` instead of the tee lane.
- Keep RRL roughout belts/accessories out of clothing comparison groups by clearing them to null.
- Apply existing narrow output for residual stale rows:
  - Acne shirt -> Acne sweat.
  - Bottega Cassette mini -> padded Cassette.
  - Margiela broad Tabi -> Tabi loafer / Tabi flat.
  - Fila golf apparel -> null because it is a golfwear row outside the current fashion lane policy.

## DB changes
- Moved 1 active RRL waffle knit henley row from `clothing-polo-rrl-tee` to `clothing-polo-rrl-knit`.
- Cleared 2 active RRL roughout belt/accessory rows to `sku_id = null`.
- Moved 1 active Acne sweat row to `clothing-acne-sweat`.
- Moved 1 active Bottega padded Cassette row to `bag-bottega-cassette-padded`.
- Moved 2 active Margiela Tabi shape rows to `shoe-margiela-tabi-loafer` and `shoe-margiela-tabi-flat`.
- Cleared 1 active Fila golf apparel row to `sku_id = null`.
- All DB writes marked `score_dirty = true`.

## Deferred
- RRL null roughout/suede shirt acquisition still remains separate; do not bulk-promote until the low-price anomaly is reviewed.

## Verification
- Latest active fashion/shoe/bag current-diff sweep over 1000 rows returned `diffTotal: 0`.
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts` passed 192/192.
- `npx tsx --test tests/core-rules.test.ts` passed 101/101.
