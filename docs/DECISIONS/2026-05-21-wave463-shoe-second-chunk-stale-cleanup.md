# Wave 463 — shoe second chunk stale cleanup

Time: 2026-05-21 10:15 KST

## Context

Wave 462 left the active shoe offset 2,500-5,000 sample with 14 current parser drift groups. The remaining drift mixed two different issues:

- True stale rows that should not stay in the representative SKU sample, such as collabs/goods/color variants/buy requests.
- Normal listings that the current parser was falsely nulling because of over-broad buy-request text handling.

## Decisions

1. Keep the cleanup conservative.
   - Cleared only rows with explicit stale evidence: Bape x JJJJound, Starbucks/Baby Milo goods, Bapesta Tiffany color, Crocs Palace/Andersson Bell, Denim Tears Converse, CDG black color in white lane, Jack Purcell Renew Denim, Crocs Baya/Crush buy request, Birkenstock Boston Wool Felt, CDG Vans Lampin/Vault, Dior B23 Cactus Jack, and one no-stock purchase-agent Gel-Kinetic row.
   - Did not clear Dior B30/B25 or Gel Nimbus rows because they were real target products and the parser was the problem.

2. Tighten buy-request parsing without opening broad SKU lanes.
   - `매입` now requires a real word/service phrase and no longer fires inside `판매입니다`.
   - Seller inventory/professional shop copy such as `매입 제품이다보니` is treated as seller-service text, not a buyer request.
   - Scarcity phrases such as `못 구해요` are not treated as buy requests.
   - Actual buy requests and no-stock purchase-agent text remain blocked.

3. Preserve size/turnover nuance for later.
   - Size-specific turnover/rate grouping is still deferred to a later wave. Current wave only cleans SKU identity and sample contamination.

## Applied

- DB: cleared 17 active stale rows from `mvp_raw_listings`, `mvp_candidate_pool`, and `mvp_listing_parsed`.
- Parser: fixed false-null causes for Dior B25/B30 shop descriptions and Asics Gel Nimbus scarcity/seller wording.
- Tests: added regression cases to `tests/wave254-6-product-type-priority.test.ts`.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 164 passed, 0 failed.
- `START_OFFSET=2500 MAX_ROWS=2500 PAGE_LIMIT=250 npx tsx scripts/wave463-shoe-currentdiff-audit.ts`
  - scanned 2,500 active shoe rows.
  - `groupsWithDiff=0`, `ranked=[]`.

## Deferred

- Continue with the next active shoe chunk after offset 5,000.
- Revisit size/turnover buckets separately; price matching stays SKU-level for now.
