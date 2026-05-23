# Wave 501 — shoe/bag ready sample tightening

## Context

Recent ready-pool QA showed that fashion parser fixes were moving in the right direction, but some shoe/bag comparison groups were still too broad for user-facing recommendations.

Primary risks found:
- `shoe|nike_collab*` collapsed unrelated collaborators.
- `shoe|adizero*` mixed Aruku / EVO SL / Boston / Adios Pro / SL2.
- `shoe|dunk_low_black_white*` accepted off-color Dunk variants.
- `bag|supreme_backpack*` mixed Field / Realtree / 23FW / generic backpack variants.
- legacy `wave92-shoe-v11` rows remained in ready/reserved pool after newer parser rollouts.

## Decisions

1. Split collaborator axis for shoe collab SKUs.
   - `shoe-cdg-nike-collab` -> `cdg_nike_collab`
   - `shoe-stussy-nike-collab` -> `stussy_nike_collab`
   - `shoe-mm6-salomon-collab` -> `mm6_salomon_collab`

2. Split high-variance model families inside the comparable key.
   - Adidas Adizero: Aruku / EVO SL / Adios Pro / Boston / SL2 / broad.
   - Asics Novablast/Superblast: `asics_novablast` vs `asics_superblast`.
   - Supreme backpack: Realtree / Field / 23FW / broad.

3. Keep Dunk Low black-white lane conservative.
   - Off-color tokens and `SE Flip` now set `needs_review=true`.

4. Add future catalog guard for Y-3 broad shoe.
   - Hat/cap/bucket terms no longer match `shoe-y3-broad`.

5. Ready/reserved pool cleanup is user-safety first.
   - If pool row parser version is stale, parsed key changed, or parsed row now needs review, invalidate it rather than letting old rows remain visible.

## Applied DB Work

- Reparsed active shoe/bag rows to new parser versions:
  - shoe: `wave92-shoe-v15`
  - bag: `wave92-bag-v13`
- Active shoe/bag reparse pass:
  - rows written: 12,591
  - comparable key changed: 1,663
  - review state changed: 76
- Final shoe v15 pass:
  - active shoe rows: 10,033
  - rows written: 10,033
  - comparable key changed: 1,285
  - review state changed: 66
- Score drain was run with all AI/shadow paths disabled:
  - `PIPELINE_AI_REVIEW_TOP_N=0`
  - `AI_REVIEW_TOP_N=0`
  - `PIPELINE_SCORE_AI_CONDITION_DAILY_LIMIT=0`
  - `AI_L2_SHADOW_AUDIT_ENABLED=0`
  - observed AI calls: 0

## Final QA

Final ready/reserved shoe/bag metrics:
- ready/reserved shoe+bag rows: 14
- old generic football bucket: 0
- old generic broad shoe bucket: 0
- old generic Supreme backpack bucket: 0
- old Novablast bucket: 0
- Dunk black-white bucket: 0
- stale parsed rows in ready/reserved: 0
- multi-row comparison groups remaining: 0

Residual dirty rows after scoreStage convergence:
- shoe: 218
- bag: 86

These residual rows are not being picked by scoreStage after convergence and should be investigated separately as a stuck-dirty selection/eligibility cleanup, not as a ready-pool contamination issue.

## Verification

- `npx tsx --test tests/wave254-5-fashion-condition.test.ts tests/wave254-6-product-type-priority.test.ts tests/core-rules.test.ts`
  - 348/348 passed.
- Additional targeted DB QA confirmed no ready/reserved old broad buckets remained.

## Deferred

- Investigate why some legacy `wave92-shoe-v11` parsed rows reappeared during score drains before final invalidation.
- Decide whether Balenciaga 3XL should split by colorway or remain model+size+condition only. Final ready pool no longer has multi-row groups, so this is not immediate.
- Size-tail velocity grouping remains separate. Price comparison can stay same-size agnostic for now, but turnover/rotation score may need a later wave for very small or very large sizes.
