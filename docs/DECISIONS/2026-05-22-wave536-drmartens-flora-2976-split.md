# 2026-05-22 Wave 536 — Dr. Martens Flora / 2976 split

## Context

- Post-deploy ready sample audit found `닥터마틴 플로라 첼시` entering `shoe-drmartens-2976-chelsea`.
- Flora is a separate women's Chelsea line and should not share 2976 Chelsea market samples.

## Decision

- Add `플로라` / `flora` to the 2976 Chelsea catalog blocklist.
- Add a regression test that Flora Chelsea rows do not match `shoe-drmartens-2976-chelsea`.
- Bump shoe parser freshness from `wave92-shoe-v16` to `wave92-shoe-v17` so existing parsed 2976 rows are forced through the new catalog blocklist.

## Verification / Ops

- `npx tsx --test tests/wave254-5-fashion-condition.test.ts tests/wave254-6-product-type-priority.test.ts tests/core-rules.test.ts`
  - 370 pass, 0 fail.
- `npm run build`
  - passed.
- Production cron started emitting `shoe:wave92-shoe-v17` rows after deploy.
- Existing polluted row `pid=381770035` was invalidated with reason `wave536_drmartens_flora_2976_split`.
- The same row was manually reparsed with local v17 catalog output:
  - `mvp_raw_listings.sku_id = null`
  - `mvp_raw_listings.sku_name = null`
  - `mvp_raw_listings.score_dirty = false`
  - `mvp_listing_parsed.category = null`
  - `mvp_listing_parsed.comparable_key = null`
  - `mvp_listing_parsed.needs_review = true`

## Deferred

- A dedicated Flora lane is not added yet.
- If Flora has enough repeatable sample volume later, split it into a ready or hold-reviewed narrow lane.
