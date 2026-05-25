# Wave 865 Clothing Top Broad Audit

Date: 2026-05-25

## Context
- User asked to keep deep-sweeping clothing/shoe categories without stopping, especially sample-comparison pollution and unsafe broad SKU routing.
- This wave resumed the clothing top broad batch after shoe Wave857-864 cleanup.

## Scope
- Audited current parsed/pool rows for top clothing broad/watch lanes:
  - Thom Browne, Stone Island, Polo Ralph Lauren, Moncler, Carhartt, CDG, Supreme, Stussy, Levi's, Champion.
- Re-ran current catalog reclassify after rule changes.

## Decisions Applied
- Polo Ralph Lauren patchwork flannel/check shirts are valid `clothing-polo-shirt-pattern`, not broad fallback.
  - Removed bare `패치워크` blocker from the pattern shirt lane.
  - Jacket/blazer tokens still block patchwork outerwear from the shirt-pattern lane.
- Supreme `clothing-supreme-collab-broad` was unsafe as public-ready catch-all.
  - Removed generic product tokens (`후드`, `맨투맨`, `크루넥`, etc.) from collab matching.
  - Added Nike/Jordan/shoe and Small Box blockers.
  - Changed `supreme_collab_broad` readiness to blocked until model-specific splits exist.
- Kept special/premium axes out of public broad:
  - Stone Island David-TC remains null/held, not generic Stone broad.
  - Supreme x Nike apparel remains null/held until a dedicated clothing split is created.
  - Champion vintage/coach-jacket rows remain null/held when explicit vintage/coach signals are present.

## Applied Backfill
- Command: `scripts/apply-fashion-current-catalog-reclassify.ts --reason=wave865_clothing_top_broad_audit --apply`
- Result:
  - scannedParsedRows: 704
  - candidateRows: 83
  - reclassifyRows: 42
  - refreshParsedRows: 34
  - rejectRows: 7
- Notable routing:
  - Polo patchwork flannel/check shirts -> `clothing-polo-shirt-pattern`
  - Supreme Small Box Crewneck 23FW -> null/held
  - Supreme x Nike Ripstop Pullover -> null/held
  - Supreme Box Logo Hoodie -> `clothing-supreme-box-logo`
  - Stussy x Nike pants -> `clothing-stussy-nike-collab`
  - Carhartt tees previously leaking into flannel shirt -> Carhartt broad/internal

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 63/63 passed.
- `npx tsx scripts/run-market-stats-stage-once.ts`
  - queued: 87
  - enriched: 87
  - scored: 1565
  - poolUpserted: 1402
  - reveal_current_profit_updated: 67
  - reveal_current_profit_invalidated: 15
- `npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --apply`
  - candidateRows: 0
- Safety reports:
  - shoe: fixNow []
  - clothing: fixNow []
  - clothing readySku: 49, safePublic 41, probablySafe 8.

## Deferred
- Do not create/release a broad Supreme x Nike clothing SKU yet. Current raw examples include pullovers, sweaters, pants, jackets and accessory/shoe wording; needs model/product split before public pool.
- Do not create/release Stone Island David-TC yet. Premium/special season axis confirmed; keep held until sample volume and sub-line split are audited.
- Champion vintage remains held where explicit vintage/60s/coach-jacket wording appears; generic Champion broad remains internal-only.

