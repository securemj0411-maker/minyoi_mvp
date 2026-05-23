# Wave 470 — LV key pouch Cles tightening

Time: 2026-05-21 12:43 KST

## Context

After BAPE cleanup, the top remaining first-5,000 fashion drift group was `bag-lv-monogram-key-pouch`.

The stale rows were not real LV key pouch listings. Most were old false positives around Korean/Latin fragments such as:

- 몽클레르 / 몽클레어
- 클레이 / 클레이그린
- 클래식 / 클레식
- 클레오
- unrelated game/TV/shoe listings

One additional stale row was a real Louis Vuitton wallet (`클레망스 지피 월릿`), but not a key pouch.

## Decisions

1. Remove bare Korean `클레` as a key pouch trigger.
   - It is too broad in Korean marketplace text and catches unrelated terms.
   - Keep explicit key pouch forms: `키파우치`, `키 포셰트`, `key pouch`, `cles`, `클레 포셰트`, `클레 파우치`.

2. Clear stale key-pouch rows instead of cross-category migrating.
   - Rows now parsing as Moncler or null were historically bad assignments.
   - Cross-migrating stale LV key-pouch rows into unrelated fashion lanes would risk preserving old noise.

## Applied

- Parser/catalog: tightened `bag-lv-monogram-key-pouch` Cles Korean matching and added explicit noise blocks for Moncler/Clay/Classic/Cleo strings.
- DB: cleared 18 active stale `bag-lv-monogram-key-pouch` rows.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 168 passed, 0 failed.
- `npx tsx scripts/wave470-lv-key-pouch-apply.ts`
  - post-apply dry-run `totalRows=0`, `total=0`.

## Deferred

- LV wallet lane recovery for `클레망스 지피 월릿` is deferred until LV wallet SKUs are audited together.
- Next first-5,000 fashion cleanup candidate: `bag-chanel-broad` stale cosmetic/shopping-bag/apparel rows.
