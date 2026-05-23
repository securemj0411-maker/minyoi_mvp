# 2026-05-21 Wave460 — Shoe target currentDiff cleanup

## Context

- Continued conservative fashion/shoe catalog sweep after Wave459.
- Focused audit targets:
  - `shoe-adidas-football`
  - `shoe-supreme-nike-sb-collab`
  - `shoe-ugg-classic-mini`
  - `shoe-asics-cecilie-bahnsen-collab`
  - `shoe-adidas-balenciaga-collab`

## Decisions

- Preserve intended collab tokens instead of broadening generic lanes:
  - Supreme x Nike SB accepts glued/abbreviated `나이키SB`, `덩크sb`, and SB Dunk wording.
  - Asics x Cecilie Bahnsen accepts glued Korean `세실리에반센`.
  - Adidas x Balenciaga allows shoe color `오프화이트/off-white` only when it modifies Stan Smith / Triple S, while still blocking true Off-White triple-collab bait.
- Treat normal seller context as safe:
  - `당첨으로 구매`, `현금 매입`, and seller store buy/sell service text no longer block otherwise valid shoe listings.
- Keep `UGG Classic Mini II / 미니 2` out of the plain Classic Mini lane for now.
  - Decision: conservative split by variant; do not merge Mini II into Classic Mini sample.
- Fix normal Adidas F50 glued variants:
  - `아디다스 F50tf`, `아디다스f50엘리트` now stay in `shoe-adidas-football`.
- DB stale cleanup:
  - Cleared 42 stale rows from active raw SKU sample:
    - 31 Adidas football limited/signature/apparel/accessory rows.
    - 6 Balenciaga x Adidas apparel rows.
    - 5 UGG Classic Mini II or non-UGG bag rows.
  - Migrated 1 wrong Adidas football row (`아디다스 오리지널스 가젤 스카이블루`) to `shoe-adidas-gazelle-og-broad`.
  - Deleted stale `mvp_listing_parsed` / `mvp_candidate_pool` artifacts for touched PIDs and marked raw rows `score_dirty=true`.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 164 pass, 0 fail.
- Focused post-apply audit:
  - `shoe-adidas-football`: count 489, `currentDiff=0`, `nullNow=0`
  - `shoe-supreme-nike-sb-collab`: count 59, `currentDiff=0`, `nullNow=0`
  - `shoe-adidas-balenciaga-collab`: count 41, `currentDiff=0`, `nullNow=0`
  - `shoe-asics-cecilie-bahnsen-collab`: count 27, `currentDiff=0`, `nullNow=0`
  - `shoe-ugg-classic-mini`: count 24, `currentDiff=0`, `nullNow=0`

## Deferred

- Size-based turnover/sample grouping remains deferred to a later wave.
- Adidas football limited/signature sub-lanes are intentionally not created yet; current policy is to exclude those from the broad football price sample until enough clean volume exists.
