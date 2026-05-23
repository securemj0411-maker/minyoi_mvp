# 2026-05-21 Wave 490 — RRL family stale split

## Context
- After latest active current-diff was clean, targeted the RRL family because many older active rows were still sitting in broad RRL or shirt/pants catch-all lanes.
- Goal was to prevent RRL shirts, pants, denim, denim jackets, knits, leather/suede jackets, Grizzly jackets, shoes, accessories, and exchange/bait rows from sharing broad comparison groups.

## Decisions
- Added direct routing for strong RRL leather/suede jacket wording.
  - Requires RRL identity, leather/suede/roughout/shearling/newsboy/G-1 style signal, and jacket/coat/chore/flight/etc. signal.
  - Blocks style/mood, blazer, Grizzly, pants, shoes, belt, wallet, pouch, cap, and jewelry signals.
- Added direct routing for RRL Grizzly jackets so `그리즐리 + 자켓/재킷` does not collide with denim or leather/suede lanes.
- Kept RRL leather/suede shirts separate from normal RRL shirts.
- Added `denim` to the RRL shirt/pants catch-all blocker, so English denim rows do not collide with shirt/pants.
- Added `트러커/trucker` to RRL denim jeans blocker, so denim trucker/jacket rows move to the denim-jacket lane.
- Treated `현대무역/더현대/현대닷컴 ... 구매` and `구매 2024년...` as purchase-history wording, not buy-request wording.

## DB changes
- Applied 165 initial active RRL stale fixes across:
  - broad RRL -> jacket/coat, denim, leather/suede jacket, pants, knit, denim jacket, Grizzly, shirt, shoe, shirt/pants, or null.
  - shirt/pants catch-all -> shirt, pants, denim, jacket/coat, or null.
  - jacket/coat -> leather/suede jacket, denim jacket, or null.
  - leather/suede jacket -> Grizzly or null.
- Applied 8 follow-up active fixes after the denim/Grizzly/purchase-history rule correction.
- Restored one true RRL black-on-black denim row after purchase-history wording was fixed.
- All DB writes marked `score_dirty = true`.

## Deferred
- Null RRL roughout/suede shirt rows are still not bulk-promoted in this wave. Several are high confidence, but one suspiciously low-price row means they need a controlled acquisition pass.
- RRL pants subfamilies such as fatigue/work pants may deserve separate lanes later; current wave only enforced existing rule output.

## Verification
- RRL target recheck over the relevant active SKU set returned `[]`.
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts` passed 191/191.
- `npx tsx --test tests/core-rules.test.ts` passed 101/101.
