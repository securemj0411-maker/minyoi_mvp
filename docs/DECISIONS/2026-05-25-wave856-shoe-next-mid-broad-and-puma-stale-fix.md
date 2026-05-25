# Wave 856 — Shoe next mid broad cleanup and Puma stale fix

## Context

After wave 855, shoe safety was clean but the next `watch_internal_only` batch still had broad lanes with enough sample history to inspect. This wave reviewed:

- `shoe-nike-spiridon-broad`
- `shoe-crocs-slipper-broad`
- `shoe-adidas-stansmith-broad`
- `shoe-nike-shox-z-broad`
- `shoe-onitsuka-broad`
- `shoe-crocs-light-ride-broad`
- `shoe-newbalance-1906r-broad`
- `shoe-ugg-classic-broad`
- `shoe-nike-superfly-broad`
- `shoe-nike-airmax-98-broad`

## Decisions

1. Split lifestyle `Nike Air Superfly` out of `Nike Mercurial Superfly` football broad. The same `superfly` word was routing both lifestyle sneakers and football boots into one key.
2. Keep the new `nike_air_superfly` lane `internal_only` until sample quality is proven.
3. Correct `shoe-ugg-classic-broad` default product type from `sneaker` to `boot`.
4. Reclass explicit UGG Classic variants from broad into existing exact lanes: Ultra Mini, Ultra Mini Platform, Mini II, Mini Platform, Mini Dipper, Clear Mini, Tall, and New Heights.
5. Reject non-comparable UGG rows from Classic broad: other-brand/generic `어그st`, generic multi-color shop rows, legwarmer/dipper accessory wording, rainboot/Tasman mismatch, and fluffy high-low rows.
6. Keep special/collab rows out of plain broad samples:
   - Nike Fragment Spiridon
   - Nike Shox Z `메탈릭실버`
   - Adidas Stan Smith Disney/Peter Pan/Tinkerbell/Case Study/limited wording
7. Route bare `오니츠카타이거 66` to `shoe-onitsuka-mexico-66`, while keeping `올림푸스66` in broad/internal watch.
8. Fix the stale Puma Nitro ready row that current rules already route to `shoe-puma-deviate-nitro`.

## Code changes

- Added `shoe-nike-air-superfly` with laneKey `nike_air_superfly`.
- Added parser exception so `Air Superfly` becomes `sneaker`, not `football_shoe`.
- Blocked `Air Superfly` wording from `shoe-nike-superfly-broad`.
- Changed `shoe-nike-superfly-broad` default product type to `football_shoe`.
- Changed `shoe-ugg-classic-broad` default product type to `boot`.
- Added broad blockers for Fragment Spiridon, Shox Z `메탈릭실버`, and Stan Smith special/collab wording.
- Added `오니츠카타이거 66` / `오니츠카 66` / `onitsuka 66` aliases to the Mexico 66 lane.
- Added regression coverage for the new splits.

## Applied DB routing

Wave 856 broad batch apply:

- scannedParsedRows: 384
- rawRows: 384
- candidateRows: 115
- reclassifyRows: 31
- refreshParsedRows: 69
- rejectRows: 15

Notable rows:

- `shoe-nike-superfly-broad` -> `shoe-nike-air-superfly`: 11 Air Superfly rows
- `shoe-onitsuka-broad` -> `shoe-onitsuka-mexico-66`: pid `327226834`
- `shoe-ugg-classic-broad` -> exact UGG lanes: 19 rows
- `shoe-nike-spiridon-broad` -> null/review: Fragment Spiridon row
- `shoe-nike-shox-z-broad` -> null/review: 2 metallic-silver rows
- `shoe-adidas-stansmith-broad` -> null/review: Disney/Peter Pan/Case Study/limited rows
- `shoe-ugg-classic-broad` -> null/review: 8 non-comparable UGG rows

Puma stale ready fix:

- pid `409142724`: `푸마 디비에이트 나이트로 3 와이드 블랙 290`
- `shoe-puma-nitro-running` -> `shoe-puma-deviate-nitro`
- scannedParsedRows: 1
- reclassifyRows: 1

## Verification

- Regression: `npx tsx --test tests/fashion-catalog-regression.test.ts` passed 55/55.
- Wave 856 stage after apply:
  - queued: 38
  - poolUpserted: 1679
  - reveal_current_profit_updated: 43
  - reveal_current_profit_invalidated: 5
- Wave 856 gate cleanup:
  - candidateRows: 4
  - applied shoe rows: 4
- Puma stale fix stage:
  - queued: 25
  - poolUpserted: 736
  - reveal_current_profit_updated: 5
  - reveal_current_profit_invalidated: 5
- Final gate cleanup:
  - candidateRows: 0
- Final safety:
  - shoe readySku 82, safe_public 80, probably_safe 2, fix_now 0
  - clothing readySku 47, safe_public 39, probably_safe 8, fix_now 0

## Deferred

- Do not promote any reviewed broad lane solely from this wave. Broad shoe lanes remain internal watch until sample quality is proven at the exact/comparable axis level.
- Continue the shoe sweep with the next safety-report batch: Skechers, Adidas Samba, Salomon RX Slide, New Balance 1906A, Y-3, Dr. Martens 1460 Black, Adidas Song for the Mute, Keen, New Balance generic/1500/1400.
