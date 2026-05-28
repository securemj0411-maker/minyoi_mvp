# Wave 917 — Core Rule Drift Fix

## Context

While checking the next Daangn optimization, `tests/core-rules.test.ts` failed
on current `main` even after the proposed catalog candidate cache was reverted.

Failures:

- Apple Watch SE2 44mm now matches the new size-specific lane
  `applewatch-se2-44mm`, while the old test still expected the broad
  `applewatch-se2` lane.
- PS5 Digital was classified by the game-console parser as
  `game_console|playstation_5|digital|full_set`, but `parseListingOptions()`
  still emitted the old generic `game_console|playstation_5` fallback.

## Decision

Fix the drift before doing more throughput work.

- Keep the Apple Watch size-specific lane behavior and update the stale test
  expectation.
- Wire `parseListingOptions()` to reuse `parseGameConsoleListing()` for
  normal game-console body listings, so stored comparable keys preserve
  platform, edition, and body configuration.
- Preserve fallback comparable keys for game titles/accessory SKUs that are not
  normal body listings.

## Deferred

- The abandoned catalog category-candidate cache was not shipped. It remains a
  possible optimization, but only after core tests are green.
- Broader matcher indexing remains the larger Daangn `rowBuild` optimization.

## Verification

- Pending targeted tests.
- Pending build.
