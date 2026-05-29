# Wave 944 — Fashion/Shoe/Bag follow-up pool cleanup

Date: 2026-05-29

## Decision
- Re-ran the fashion/shoe/bag ready/reserved pool sweep after Wave 931 cleanup.
- Fixed `scripts/apply-cross-category-current-reparse-cleanup.ts` pagination because a single PostgREST `limit=5000` request was capped at 1,000 rows. The cleanup now scans all ready/reserved fashion rows in 1,000-row pages.
- Applied a scoped 4-row cleanup for current parser/catalog drift:
  - 2 rows had stale comparable keys/tiers and needed parsed refresh + pool rebuild.
  - 2 rows were still ready even though their current lane readiness is blocked.
- Kept `shoe_product_type_defaulted_to_sneaker` as an audit signal only. It is not a hard blocker yet because many running shoes/sneakers are legitimate defaults.

## Scope
- scope: pool (ready,reserved)
- raw/parsed/pool rows: 1663/1663/1663
- windowHours: 168

## Expected parser versions
- shoe: wave92-shoe-v41
- clothing: wave216-clothing-v52
- bag: wave92-bag-v24

## Findings Snapshot
- raw SKU rejected by current catalog: 0
- raw SKU differs from current catalog: 0
- DB-clean rows that current catalog rejects: 0
- pool exposed with catalog/parser drift: 0
- parsed stale version: 0
- shoe unknown condition: 0
- shoe defaulted to sneaker: 93
- flagged comparable groups: 14
- pool drift plan rows: 0
- null SKU rows that would match current catalog now: 0

## Apply Summary
- command: `npx tsx scripts/apply-cross-category-current-reparse-cleanup.ts --categories=shoe,clothing,bag --statuses=ready,reserved --reason=wave944_fashion_pool_key_rebuild --apply`
- scanned pool rows: 1667
- candidate rows: 4
- invalidated pool rows: 4
- refresh rows: 4
- categories: shoe 3, clothing 1
- primary reasons:
  - parsed_key_drift: 2
  - gate_blocked_lane_blocked_stussy_nike_shoe_collab: 1
  - gate_blocked_lane_blocked_puma_nitro_running: 1

## Post-Apply Verification
- fashion ready/reserved sweep:
  - raw SKU rejected by current catalog: 0
  - raw SKU differs from current catalog: 0
  - DB-clean rows that current catalog rejects: 0
  - DB-clean rows that current catalog changes key: 0
  - pool exposed with catalog/parser drift: 0
  - parsed stale version: 0
  - pool drift plan rows: 0
- cleanup dry-run after apply:
  - scanned pool rows: 1663
  - candidate rows: 0
  - invalidate pool rows: 0

## Top Flags
- shoe_product_type_defaulted_to_sneaker: 93

## Top Raw SKU Drift

## High-Signal Samples
- pid 345987442: [265] 아식스 x 세실리에 반센 젤 터레인 MT / raw=shoe-asics-cecilie-bahnsen-collab / current=shoe-asics-cecilie-bahnsen-collab / dbKey=shoe|asics_cecilie_bahnsen_collab|sneaker|a_grade / currentKey=shoe|asics_cecilie_bahnsen_collab|sneaker|a_grade / pool=ready / flags=shoe_product_type_defaulted_to_sneaker,shoe_row_has_bag_terms
- pid 378956398: 아디다스 웨일스 보너 삼바 폭스브라운 275 / raw=shoe-adidas-samba-wales-bonner / current=shoe-adidas-samba-wales-bonner / dbKey=shoe|samba_wales_bonner|sneaker|a_grade / currentKey=shoe|samba_wales_bonner|sneaker|a_grade / pool=ready / flags=shoe_product_type_defaulted_to_sneaker,shoe_row_has_clothing_terms
- pid 407454898: 꼼데가르송 살로몬xa 275 / raw=shoe-cdg-salomon-collab / current=shoe-cdg-salomon-collab / dbKey=shoe|cdg_salomon_collab|sneaker|b_grade / currentKey=shoe|cdg_salomon_collab|sneaker|b_grade / pool=ready / flags=shoe_product_type_defaulted_to_sneaker,shoe_row_has_clothing_terms
- pid 9000180152484: 호카 마파테 스피드2 250새상품팝니다 / raw=shoe-hoka-mafate-speed / current=shoe-hoka-mafate-speed / dbKey=shoe|mafate_speed|sneaker|a_grade / currentKey=shoe|mafate_speed|sneaker|a_grade / pool=ready / flags=shoe_product_type_defaulted_to_sneaker
- pid 9000579049600: 호카 마파테 스피드2 블랙캐슬락 240 미착용 / raw=shoe-hoka-mafate-speed / current=shoe-hoka-mafate-speed / dbKey=shoe|mafate_speed|sneaker|a_grade / currentKey=shoe|mafate_speed|sneaker|a_grade / pool=ready / flags=shoe_product_type_defaulted_to_sneaker
- pid 9001702975872: 뉴발란스 2002R GORE-TEX 블랙/그레이 225 / raw=shoe-newbalance-2002r / current=shoe-newbalance-2002r / dbKey=shoe|2002r|sneaker|b_grade / currentKey=shoe|2002r|sneaker|b_grade / pool=ready / flags=shoe_product_type_defaulted_to_sneaker
- pid 9001706537597: 호카 마파테 스피드2 블랙캐슬락 240 미착용 / raw=shoe-hoka-mafate-speed / current=shoe-hoka-mafate-speed / dbKey=shoe|mafate_speed|sneaker|a_grade / currentKey=shoe|mafate_speed|sneaker|a_grade / pool=ready / flags=shoe_product_type_defaulted_to_sneaker
- pid 9002025888659: 아식스 노바블라스트5 에키덴 255사이즈 / raw=shoe-asics-novablast / current=shoe-asics-novablast / dbKey=shoe|asics_novablast|sneaker|a_grade / currentKey=shoe|asics_novablast|sneaker|a_grade / pool=ready / flags=shoe_product_type_defaulted_to_sneaker
- pid 9002303861465: 아식스 노바블라스트 5 블랙 280mm / raw=shoe-asics-novablast / current=shoe-asics-novablast / dbKey=shoe|asics_novablast|sneaker|a_grade / currentKey=shoe|asics_novablast|sneaker|a_grade / pool=ready / flags=shoe_product_type_defaulted_to_sneaker
- pid 9003033213176: 호카 마파테 스피드 2 240mm 새상품 / raw=shoe-hoka-mafate-speed / current=shoe-hoka-mafate-speed / dbKey=shoe|mafate_speed|sneaker|a_grade / currentKey=shoe|mafate_speed|sneaker|a_grade / pool=ready / flags=shoe_product_type_defaulted_to_sneaker
- pid 9003332886607: 퓨마 스피드캣 레드 230 / raw=shoe-puma-speedcat / current=shoe-puma-speedcat / dbKey=shoe|speedcat|sneaker|b_grade / currentKey=shoe|speedcat|sneaker|b_grade / pool=ready / flags=shoe_product_type_defaulted_to_sneaker
- pid 9003653855908: 아식스 노바블라스트5 화이트 / raw=shoe-asics-novablast / current=shoe-asics-novablast / dbKey=shoe|asics_novablast|sneaker|a_grade / currentKey=shoe|asics_novablast|sneaker|a_grade / pool=ready / flags=shoe_product_type_defaulted_to_sneaker

## Pool Drift Plan

## Read
- Production ready/reserved fashion rows are on the latest parser versions, so this is not an old-parser deploy lag issue.
- The previous ready/reserved comparable-key drift is now clean after the scoped 4-row apply.
- `shoe_unknown_condition` and `shoe_product_type_defaulted_to_sneaker` are signal-quality audit queues, not automatic invalidation criteria yet.

## Deferred
- Catalog/parser patches should be driven by the top flagged samples rather than broad hand edits.
- Do not hard-gate all `shoe_product_type_defaulted_to_sneaker` rows yet. First sample whether those defaults are actually bad product-type splits or just acceptable sneaker/running-shoe fallback.

## Artifacts
- `reports/fashion-shoe-db-sweep-latest.json`
- `reports/fashion-shoe-db-sweep-latest.md`
