# 2026-05-21 Wave 489 — Latest active fashion current-diff to zero

## Context
- After Wave 488, reran the latest active fashion/shoe/bag current-diff sweep.
- The remaining rows were mostly stale assignments where existing rules already wanted a narrower or safer SKU.

## Decisions
- Route RRL roughout/suede/leather shirt wording directly to `clothing-polo-rrl-shirt-leather-suede`.
  - Required RRL identity + leather/suede/roughout signal + shirt/overshirt/workshirt/western signal.
  - Blocked jacket, pants, shoes, belt, wallet, pouch, cap, and jewelry signals from this direct route.
- Keep RRL leather/suede shirts out of the normal RRL shirt lane so the high-value shirt lane does not collide with ordinary shirts.
- Treat the Birkenstock Arizona row with “추가금 오가는 교환도 가능” as excluded under the existing exchange-request policy.
- Clear reusable shopping bag / paper bag residue from Stussy bag lanes.
- Move RRL cardigan/sweater stale rows from broad shirt/pants or broad RRL into `clothing-polo-rrl-knit`.

## DB changes
- Moved 4 active RRL roughout/suede shirt stale rows from `clothing-polo-rrl-shirt-pants` to `clothing-polo-rrl-shirt-leather-suede`.
- Cleared 1 active Birkenstock Arizona exchange-possible row to `sku_id = null`.
- Cleared 1 active Stussy/Supreme reusable shopping bag residue row to `sku_id = null`.
- Moved 2 active RRL knit/cardigan stale rows to `clothing-polo-rrl-knit`.
- All DB writes marked `score_dirty = true`.

## Deferred
- Null active RRL roughout/suede shirt rows were not bulk-promoted in this wave. They are high-confidence candidates, but should be reviewed separately because one sample had an implausibly low listed price.
- RRL leather/suede jacket tail rows still need a separate stale-vs-current audit.

## Verification
- Latest active fashion/shoe/bag current-diff sweep over 1000 rows returned `diffTotal: 0`.
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts` passed 190/190.
- `npx tsx --test tests/core-rules.test.ts` passed 101/101.
