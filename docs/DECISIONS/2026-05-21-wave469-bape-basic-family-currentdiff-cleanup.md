# Wave 469 — BAPE basic family current-diff cleanup

Time: 2026-05-21 12:31 KST

## Context

The first non-shoe fashion active audit showed BAPE as the largest drift group in the first 5,000 active fashion rows:

- `clothing-bape-tee` had 107 current-diff rows.
- `clothing-bape-shark-hoodie` had 26 current-diff rows.

Most drift came from old tee assignments now clearly parsing as hoodie, hoodie zip, crewneck, or shark hoodie. A smaller but riskier set came from collaborations, AAPE/diffusion-line items, accessories, and non-hoodie shark product types.

## Decisions

1. Keep BAPE basic lanes conservative.
   - Basic BAPE tee/hoodie/hoodie zip/crewneck/shark hoodie should not absorb Adidas, Puma, Lacoste, Tommy, JJJJound, Neighborhood, WTAPS, God Selection, Tom and Jerry, AAPE, homage, or unknown collaboration rows.
   - These rows were cleared rather than migrated into basic BAPE lanes.

2. Migrate only clear product-type drift inside the BAPE basic family.
   - Old tee rows that now parse as BAPE hoodie, hoodie zip, crewneck, or shark hoodie were moved to the current basic family lane.
   - Shark hoodie rows that are not hoodie-shaped, or are accessories/pants/shorts/jackets, were cleared.

3. Treat AAPE as out-of-scope for BAPE basic comparable groups for now.
   - AAPE may be related, but its price behavior should not contaminate BAPE basic rows until explicitly modeled.

## Applied

- Parser/catalog: added BAPE basic-lane blocks for broad collaboration and diffusion/homage tokens.
- DB:
  - First pass: 150 active stale rows changed.
  - Residual pass: 4 active stale rows changed.
  - Total: 154 BAPE-family active rows migrated or cleared.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 168 passed, 0 failed.
- `npx tsx scripts/wave469-bape-apply.ts`
  - post-apply dry-run `total=0`.
- `START_OFFSET=0 MAX_ROWS=5000 PAGE_LIMIT=500 npx tsx scripts/wave469-fashion-full-currentdiff-audit.ts`
  - BAPE no longer appears as a meaningful top drift group in the first 5,000 active fashion rows.

## Deferred

- Dedicated BAPE collaboration SKUs are deferred until there is enough clean sample volume per collaboration.
- Size/turnover bucketing remains deferred to a separate wave.
