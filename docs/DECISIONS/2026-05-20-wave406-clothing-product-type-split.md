# 2026-05-20 Wave 406 - Clothing Product-Type Split

## Decision
- Operator-pool comments around 18:38-18:49 KST showed clothing comparable samples mixing obvious different product types.
- Split `long_sleeve_tee` out of generic `tee` so Polo Bear tee and Polo Bear long sleeve no longer share one comparable key.
- Split `hoodie_zip` out of generic `hoodie` so Stussy hoodie and Stussy zip hoodie no longer share one comparable key.
- Bumped clothing parser version to `wave216-clothing-v11` and updated stale-parser detection so existing v10 clothing rows are eligible for reparse.

## Why
- The prior parser explicitly returned `tee` for `롱슬리브/긴팔`, which made the user-reported Polo Bear tee vs long sleeve mix expected behavior.
- The prior parser matched `후드` before `집업`, so `후드집업` could enter the same hoodie market sample as pullover hoodies.

## Deferred
- No database mutation in this wave.
- Stussy graphic/logo-level separation (`8ball`, `world tour`, `stock`, etc.) remains a follow-up because it needs a broader sample policy, not just a regex guard.
- Fashion bag/football-shoe brand-line mismatches from the same comment batch remain separate follow-ups.

## Verification
- `npx tsx --test tests/wave254-5-fashion-condition.test.ts tests/fashion-catalog-regression.test.ts`
