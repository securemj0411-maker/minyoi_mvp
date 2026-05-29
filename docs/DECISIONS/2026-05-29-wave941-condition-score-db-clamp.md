# 2026-05-29 Wave 941 - condition_score DB clamp

## Context

- After the tech-device condition parser changes, a production A score-worker run failed while upserting `mvp_listing_parsed`.
- Error:
  - `mvp_listing_parsed_condition_score_check`
  - failing row had `condition_score = -0.25`
- Root cause:
  - `conditionFromText()` clamps its own score, but later category evidence gates can subtract more deltas from `conditionScore`.
  - The final `ParsedListingOptions.conditionScore` was returned without a final clamp.

## Decision

- Clamp the final parser output with `cap01(conditionScore)` at the `parseListingOptions()` return boundary.
- Add a regression test where multiple hard smartphone risk signals would otherwise push score below zero.

## Verification

- `npx tsx --test tests/wave940-condition-score-clamp.test.ts tests/wave249-pool-builder-clamp-fix.test.ts`
  - 14 pass, 0 fail
- `npx eslint src/lib/option-parser.ts tests/wave940-condition-score-clamp.test.ts`
  - pass

## Deferred

- This does not change condition classification policy; it only enforces the DB contract at the parser boundary.
- Existing uncommitted parser/evidence work from the parallel session was intentionally not staged.
