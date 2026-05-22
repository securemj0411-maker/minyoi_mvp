# 2026-05-22 Wave 535 — parser/pool deploy readiness

## Context

- The parser/pool hardening work is locally consistent, but latest production DB parsed rows still show old deployed versions.
- Latest 200 fashion/shoe/bag parsed rows in DB were mostly:
  - `shoe:wave92-shoe-v11`: 150
  - `clothing:wave216-clothing-v13`: 41
  - `bag:wave92-bag-v11`: 6
- Current local versions are:
  - shoe: `wave92-shoe-v16`
  - bag: `wave92-bag-v13`
  - clothing: `wave216-clothing-v20`

## Deploy Scope

Minimum runtime files that need to move together:

- `src/lib/catalog.ts`
- `src/lib/generated/catalog-bag-wave91.ts`
- `src/lib/generated/catalog-shoe-broad-wave133.ts`
- `src/lib/generated/catalog-shoe-broad-wave138.ts`
- `src/lib/generated/catalog-shoe-narrow-wave134.ts`
- `src/lib/generated/catalog-shoe-wave91.ts`
- `src/lib/generated/catalog-wave266-bag.ts`
- `src/lib/generated/catalog-wave266-clothing.ts`
- `src/lib/generated/catalog-wave266-shoe.ts`
- `src/lib/category-readiness.ts`
- `src/lib/parsers/wave92-fashion-mobility.ts`
- `src/lib/option-parser.ts`
- `src/lib/condition-policy.ts`
- `src/lib/candidate-pool-builder.ts`
- `src/lib/tick-pipeline.ts`
- `src/lib/pipeline.ts`
- `src/lib/ai-l2-shadow-audit.ts`

Hold out of parser-only deploy unless separately approved:

- `src/lib/marketplace-safety.ts`
- `src/lib/pack-open.ts`
- `src/lib/plan-config.ts`
- UI / billing / legal / admin component changes outside the parser/pool path.

Associated tests:

- `tests/core-rules.test.ts`
- `tests/wave249-pool-builder-clamp-fix.test.ts`
- `tests/wave254-5-fashion-condition.test.ts`
- `tests/wave254-6-product-type-priority.test.ts`

## Additional Safety Fix

- `ai_audit_status = null` now remains "not audited yet", not a hard non-pass residue.
- Only definite non-pass values (`hold`, `reject`, `skipped_unavailable`) are invalidated by the AI audit residue cleanup.
- Reason: shadow audit is budget-capped; invalidating null/missing before audit can shrink ready pool accidentally.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 261 pass, 0 fail.
- `npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/marketplace-safety.test.ts tests/wave254-5-fashion-condition.test.ts tests/wave254-6-product-type-priority.test.ts`
  - 386 pass, 0 fail.
- After the AI missing-status safety fix:
  - `npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave254-5-fashion-condition.test.ts tests/wave254-6-product-type-priority.test.ts`
  - 380 pass, 0 fail.
- AI shadow-audit focused regression:
  - `npx tsx --test tests/wave238-ai-l2-shadow-audit.test.ts tests/core-rules.test.ts`
  - 112 pass, 0 fail.
- `npm run build`
  - passed.
- `git diff --check` over the touched parser/catalog/test/log scope
  - passed.

## Production Baseline Before Deploy

- Current ready pool: 263.
- Current ready pool with `expected_profit_min <= 150000`: 240.
- Ready fashion rows with missing AI audit status: 1.
- Latest 200 parsed fashion rows still use old deployed versions:
  - `clothing:wave216-clothing-v13`: 58
  - `shoe:wave92-shoe-v11`: 129
  - `bag:wave92-bag-v11`: 13

## Risk

- Worktree contains many unrelated dirty files across mobile UI, billing/PG, legal pages, admin views, and other runtime areas.
- Do not deploy the whole working tree blindly if the goal is only parser/pool hardening.
- The app has cron workers every minute (`tick`, `detail-worker`, `score-worker`), so once deployed, parser versions should start appearing quickly in DB if the new build is active.

## Next Safe Step

1. Create a scoped commit or patch containing only the runtime deploy scope above plus relevant tests/logs.
2. Deploy that scoped commit.
3. After deployment, query latest parsed rows again and expect new rows to show:
   - `wave92-shoe-v16`
   - `wave92-bag-v13`
   - `wave216-clothing-v20`
4. Run one narrow score/replay check rather than repeated broad `scoreStage`, because broad score runs can trigger AI shadow audit spend.
