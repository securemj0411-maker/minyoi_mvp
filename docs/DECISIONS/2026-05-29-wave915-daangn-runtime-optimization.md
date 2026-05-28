# 2026-05-29 Wave 915 — Daangn runtime optimization review

## Context

After Wave 914 leaf-region rollout, A/B/C Daangn workers are fetching successfully with `blockedCombos=0` and `failedCombos=0`.

Recent production timings showed fetch itself is no longer the bottleneck:

- A worker: `searchFetch` about 5-6s, total about 53-56s.
- B worker: `searchFetch` about 8-10s, total about 102-112s.
- C worker: `searchFetch` about 6s, total about 75-89s.

The large `rawUpsert` timing was misleading: the actual raw RPC is only about 2-3s. The slow path is the wrapper around it: existing-row preflight, changed-row classifier/parser build, then RPC writes.

## Changes

1. Parallelized Daangn preflight existing-row reads.
   - Previous path read `mvp_raw_listings` pid chunks sequentially.
   - New path keeps the same 250-row chunk size but reads up to 4 chunks at once.
   - This does not increase external marketplace traffic and does not raise the write/classify cap.

2. Added `timingsMs.rowBuild`.
   - Separates `classifyListing + parseListingOptions` time from `rawRpc`.
   - This lets the next production logs show whether the remaining bottleneck is classifier/parser CPU or DB/network.

3. Disabled embedded terminal lifecycle recheck by default.
   - Production logs show the embedded terminal claim RPC repeatedly timing out with `57014 canceling statement due to statement timeout`.
   - The main lifecycle sweep succeeds, then the embedded terminal recheck creates failed collect runs.
   - Explicit `?mode=terminal-recheck` still works for manual/targeted runs.

## Deferred

- DB-side terminal lifecycle claim rewrite/indexing.
  - The current terminal claim path joins terminal raw listings and lifecycle rows in a way that times out in production.
  - Needs a schema/migration pass, preferably after inspecting the live query plan.

- Classifier/parser CPU optimization.
  - A small catalog candidate-cache experiment did not materially reduce row build time, so it was not kept.
  - Next useful path is a real catalog hint-to-candidate index or a Daangn-specific fast classifier preselect, with precision tests.

## Verification

- Targeted Daangn tests passed:
  - `npx tsx --test tests/daangn-ingest.test.ts tests/home-region-matcher.test.ts`

## Next Work

1. Deploy and compare post-Wave-915 `timingsMs.preflight`, `timingsMs.rowBuild`, and `timingsMs.rawRpc` on A/B/C.
2. If `rowBuild` dominates, build a precision-safe candidate index for `ruleMatchWithinCategories`.
3. If terminal recheck is still needed, add DB migration for the terminal claim path before re-enabling embedded terminal recheck.
