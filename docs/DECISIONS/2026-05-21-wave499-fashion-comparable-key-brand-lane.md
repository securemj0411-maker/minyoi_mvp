# 2026-05-21 Wave 499 — Fashion comparable_key brand/lane preservation

## Context

Recent `/me` debug feedback showed that catalog matching had improved, but market samples were still mixing unrelated items. The clearest failures were:

- Backpacks sharing generic `bag|backpack|...` samples across Supreme, Carhartt, Lululemon, etc.
- Luxury shoes sharing generic `shoe|broad|...` samples across Dior, Gucci, Hermes, Louis Vuitton, etc.
- Narrow bag lanes such as Bottega Cassette and LV wallet/cardholder losing brand context in `comparable_key`.

The root problem was not only catalog matching. `sku_id` was often correct, but `modelFromSku(...)` collapsed bag and broad shoe models too aggressively, so downstream market stats and candidate samples could recombine them.

## Decision

Preserve brand/lane identity in fashion `comparable_key` generation:

- Bag parser `wave92-bag-v12` keeps the SKU brand/lane suffix in the model key.
  - `bag-supreme-backpack` -> `supreme_backpack`
  - `bag-carhartt-backpack` -> `carhartt_backpack`
  - `bag-bottega-cassette-mini` -> `bottega_cassette_mini`
  - `bag-margiela-5ac-mini` -> `margiela_5ac_mini`
- Shoe parser `wave92-shoe-v12` keeps brand for broad shoe lanes.
  - `shoe-dior-broad` -> `dior_broad`
  - `shoe-gucci-broad` -> `gucci_broad`
  - `shoe-hermes-broad` -> `hermes_broad`
  - football broad exceptions remain brand-specific.

This is a structural key-axis correction, not another negative-rule patch. It reduces the need for `mustNot`-style cleanup because unrelated brands no longer land in one shared market bucket after SKU matching.

## Applied

- Updated parser version drift targets for `shoe` and `bag` so stale rows reparse toward v12.
- Added regression tests proving:
  - Supreme / Carhartt / Lululemon backpacks no longer share one generic backpack key.
  - Dior / Gucci broad shoes no longer share one generic luxury broad key.
  - Existing Bottega and Margiela narrow bag expectations now include brand/lane in the comparable key.
- Reparsed active done shoe/bag rows in DB:
  - active rows reparsed: `12,483`
  - actual key changes: `8,620`
  - version-only refreshes: `3,863`
  - raw rows marked `score_dirty=true`: `12,483`
  - market invalidation keys queued: `9,639`
- Cleaned stale user-facing pool rows:
  - ready/reserved bag/shoe pool rows checked: `37`
  - parsed/pool comparable key mismatches invalidated: `25`
  - current stale generic ready rows:
    - `bag|backpack*`: `0`
    - `shoe|broad*`: `0`

## Verification

- `npx tsx --test tests/wave254-5-fashion-condition.test.ts tests/wave254-6-product-type-priority.test.ts tests/core-rules.test.ts`
  - `342/342` passed.
- DB spot checks confirmed:
  - Supreme backpack rows now parse to `bag|supreme_backpack|...`
  - Carhartt backpack rows now parse to `bag|carhartt_backpack|...`
  - Bottega Cassette rows now parse to `bag|bottega_cassette_mini|...`
  - Dior/Hermes broad shoe rows now parse to `shoe|dior_broad|...` / `shoe|hermes_broad|...`

## Deferred

- Dirty queue remains for normal score worker drain:
  - bag dirty active rows after two score passes: `1,895`
  - shoe dirty active rows after two score passes: `9,003`
- Manual score passes processed `1,300` dirty rows total and added `9` new pool rows. They also made `3` AI condition calls because the local env has `PIPELINE_SCORE_AI_CONDITION_DAILY_LIMIT` enabled and one manual drain used a static import before env override. Future manual drain should set the limit to `0` before a dynamic import unless AI review is intended.
- `mvp_category_readiness` still says `clothing=ready`, while runtime code hard-gates clothing to lane-ready only. This drift should be aligned in a later cleanup, but the current runtime gate is conservative and prevents broad clothing exposure.
