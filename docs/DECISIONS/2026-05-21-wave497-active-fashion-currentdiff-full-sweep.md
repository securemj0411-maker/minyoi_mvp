# 2026-05-21 Wave 497 — Active fashion current-diff full sweep

## Context
- Continued the conservative fashion/shoe/bag parser cleanup after the latest active-tail waves.
- The user explicitly wanted ready SKU coverage narrowed to high-confidence catalog/sample groups, with fewer product-type and comparison-sample mixups.
- Main risk areas were broad apparel lanes absorbing collaborations, bags, wallets, shoes, bundles, styling-context descriptions, and seller/purchase-history phrases.

## Decisions
- Treat purchase-history wording as safe context instead of buy-request noise when it says the seller bought the item:
  - Examples: `구매함`, `구매 100초반`, `139,000원에 구매`.
- Keep true buy/exchange/request posts blocked:
  - Example: size-exchange/request rows continue to clear out of ready comparison samples.
- Split MLB into safer lanes:
  - `clothing-mlb-cap` is cap-only.
  - `clothing-mlb-cap-gucci-collab` is separate.
  - `clothing-mlb-apparel-broad` is allowed only for clear apparel and blocks brand-stuffed bait.
- Keep CDG x Lacoste and FOG Essentials ambiguous apparel conservative:
  - CDG x Lacoste does not enter generic CDG or generic Lacoste.
  - FOG Essentials polo/collar/vest context stays broad instead of being forced into the tee lane.
- Block multi-item and set listings from single-item comparable groups:
  - Added bundle/setup signals such as `일괄`, `묶음`, `7벌 일괄`, `셋업`.
- Preserve seller credibility phrases:
  - `판매/구매 합니다` in a seller authenticity phrase is not treated as a buy-request by itself.
- Prevent description styling context from promoting product type:
  - Polo shorts mentioning shirts/tees stay out of the Pony tee lane.
  - Stussy coach jackets mentioning stock-logo printing stay out of the Basic tee lane.
  - Acne Baker/dog-bag rows stay out of the Acne PVC tote lane.
- Tighten Supreme generic apparel broad against unrelated brand-stuffed rows:
  - Added Nike/Adidas/MLB/Puma/Reebok blocks so Supreme broad does not absorb mixed-brand apparel or collab residue.

## DB changes
- Ran a full active fashion/shoe/bag current-diff sweep across `mvp_raw_listings`.
- Patched stale active rows to the current parser output, including:
  - Acne shirt/sweat/knit/jacket residuals.
  - Supreme x Nike leather shoulder bag to the specific bag lane.
  - Supreme x Nike SB GTS to the shoe collab lane.
  - Supreme x Nike apparel residue out of generic Supreme apparel broad.
  - FOG/MLB/Lacoste/Acne/Polo/Stussy false positives out of narrow lanes where needed.
- All DB writes set `score_dirty = true` for downstream rescoring.

## Deferred
- Size-dependent turnover modeling remains a separate future wave. Price may not need size splitting, but rotation/risk can.
- Do not open additional narrow lanes for low-sample variants until there are enough clean samples:
  - FOG Essentials polo-specific lane.
  - Nike x Supreme apparel sub-lines.
  - Acne Baker/dog-bag lane.
  - More material-specific LV/Pochette and Miu Miu/Ivy tote recovery.
- Continue using null/broad holdouts when a product family is popular but still too shape-variable for safe ready samples.

## Verification
- Full active fashion/shoe/bag current-diff verification returned `DONE totalRows=25891 totalDiff=0`.
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts` passed 199/199.
- `npx tsx --test tests/core-rules.test.ts` passed 101/101.
