# 2026-05-29 Wave 916 — Daangn classifier reuse optimization

## Context

Wave 915 production logs confirmed the next Daangn bottleneck after preflight
parallelization:

- B worker preflight dropped to about 6.5s on the first post-deploy sample.
- The remaining dominant cost was `rowBuild` at about 49.6s for 741 rows.
- `rawRpc` stayed small, about 1-2s, so the database write itself was not the
  main problem.

The row build path runs `classifyListing` and `parseListingOptions`. That is
needed for new rows or changed parser input, but not for an already-classified
Daangn row whose title, description preview, and price have not changed.

## Decision

Reuse the existing normal `sku_id`/`sku_name` for stable Daangn rows instead of
re-running the expensive classifier/parser on every scheduled touch.

Reuse is allowed only when:

- the existing row has `listing_type='normal'`;
- the existing row has a catalog-valid `sku_id`;
- title is unchanged;
- price is unchanged;
- description preview is unchanged.

The row is still sent through the raw upsert path, so lifecycle, last seen,
favorite/comment counts, region, shipping inference, and Daangn seller detail
signals can still update. Parsed-option rows are not rewritten for reused rows
because the parser input is unchanged.

## Instrumentation

Added timing/count fields:

- `timingsMs.writeCandidates`
- `timingsMs.classifyCandidates`
- `timingsMs.preflightReusedClassified`

This lets production logs show how much of `rowBuild` is still true classifier
work versus cheap reuse.

## Deferred

- Catalog-wide rematching remains explicit reparse/rematch job territory. It is
  intentionally not done on every Daangn firehose tick.
- If production shows many changed rows still running classifier/parser, the next
  optimization target is a precision-safe candidate index inside the catalog
  matcher.

## Verification

- `npx tsx --test tests/daangn-ingest.test.ts tests/home-region-matcher.test.ts`
  passed.
