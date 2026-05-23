# Wave 467 — shoe final tail cleanup

Time: 2026-05-21 11:28 KST

## Context

Audited the final active shoe tail from offset 12,500. Initial drift had 12 groups. Most remaining rows were stale shoe assignments in broad/collab lanes:

- Nike x Stussy shoe lane contained hats, socks, sunglasses, posters, crewnecks, windbreakers, anoraks, and vague apparel rows.
- Vans lanes contained Palace/WTAPS collabs, a crossbody bag, Givenchy slip-ons, and brand-stuffed non-Vans listings.
- Y-3 broad contained camera/apparel/other-brand rows.
- TNF, Supreme x Dr. Martens, and Supreme x Timberland lanes contained KAWS or mixed-collab rows.

## Decisions

1. Tighten Nike x Stussy footwear matching around verified shoe/model signals.
   - Required a Nike + Stussy token plus a footwear/model token.
   - Preserved real footwear lines including Air Max, Air Force, Huarache, Air Penny, Spiridon, Benassi, LD-1000, Vandal, Kukini, Baltoro, Air Flight, slippers/slides, and the shorthand `스투시맥스`.
   - Kept bucket hats, socks, sunglasses, posters, crewnecks, sets, anoraks, and vague apparel out of the shoe lane.

2. Recover valid final-tail shoe rows that the parser was too cautious about.
   - Allowed Vans Authentic denim material rows to remain in `shoe-vans-authentic`.
   - Added TNF boot/bootie wording (`부츠`, `부띠`, `방한부츠`) to `shoe-tnf-hiking-boots`.
   - Blocked Adidas Gazelle Beach sandal/slide rows from the Gazelle OG broad lane.

3. Clear remaining stale rows where titles prove a different product class or collab.
   - Cleared Nike x Stussy non-footwear/apparel rows from the shoe lane.
   - Cleared Y-3 non-shoe rows.
   - Cleared Vans Palace/WTAPS/other-brand/bag rows from plain Vans lanes.
   - Cleared TNF KAWS mule, Supreme Dr. Martens mixed-collab, and Supreme Timberland x CDG triple-collab rows.

## Applied

- DB: cleared 56 active stale rows across final-tail shoe lanes.
- Parser/catalog: tightened Nike x Stussy footwear, Vans denim material, TNF bootie wording, and Gazelle Beach slide exclusion.
- Tests: added Wave 467 regression coverage to `tests/wave254-6-product-type-priority.test.ts`.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 165 passed, 0 failed.
- `START_OFFSET=12500 MAX_ROWS=2500 PAGE_LIMIT=250 npx tsx scripts/wave467-shoe-currentdiff-audit.ts`
  - scanned 1,844 active shoe rows.
  - `groupsWithDiff=0`, `ranked=[]`.

## Deferred

- Run a full active shoe current-diff audit after chunk cleanup.
- Size/turnover bucketing remains deferred for a separate wave.
