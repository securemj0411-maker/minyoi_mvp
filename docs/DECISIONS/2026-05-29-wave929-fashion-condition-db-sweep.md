# Wave 929 — Fashion/Shoe/Bag condition DB sweep

Date: 2026-05-29

## Decision
- Ran a read-only DB sweep focused on fashion raw SKU drift, current parser-version drift, product-type unknowns, and comparable-key contamination.
- Treat `mvp_raw_listings.sku_id` drift as the first-class risk because market sample reparsing currently trusts stored raw SKU IDs.
- Added `--scope=pool` so the operator-facing ready/reserved pool can be audited without the broad raw-listing scan timing out on production-sized clothing rows.
- Do not overwrite old Wave 405 decision logs from this script anymore; every new run should write a dated wave log.

## Scope
- scope: pool (ready,reserved)
- raw/parsed/pool rows: 1548/1548/1548
- windowHours: 168

## Expected parser versions
- shoe: wave92-shoe-v41
- clothing: wave216-clothing-v52
- bag: wave92-bag-v24

## Findings Snapshot
- raw SKU rejected by current catalog: 0
- raw SKU differs from current catalog: 8
- DB-clean rows that current catalog rejects: 0
- pool exposed with catalog/parser drift: 27
- parsed stale version: 0
- shoe unknown condition: 118
- shoe defaulted to sneaker: 92
- flagged comparable groups: 25
- null SKU rows that would match current catalog now: 0

## Top Flags
- shoe_unknown_condition: 118
- shoe_product_type_defaulted_to_sneaker: 92
- pool_exposed_with_catalog_or_parser_drift: 27
- db_key_differs_from_raw_reparse: 23
- db_key_differs_from_current_catalog_reparse: 23
- db_clean_but_current_catalog_changes_key: 23
- raw_sku_differs_from_current_catalog: 8
- shoe_unknown_size: 1

## Top Raw SKU Drift
- shoe-mizuno-alpha -> shoe-mizuno-alpha-2: 2
- shoe-mizuno-alpha -> shoe-mizuno-alpha-3: 1
- shoe-mizuno-alpha -> shoe-mizuno-alpha-japan: 1
- clothing-thombrowne-apparel-broad -> clothing-thombrowne-sweat-hoodie: 1
- clothing-thombrowne-apparel-broad -> clothing-thombrowne-cardigan: 1
- clothing-polo-apparel-broad -> clothing-polo-vintage: 1
- clothing-polo-chiefkeef-stadium -> clothing-polo-chiefkeef-modern: 1

## High-Signal Samples
- pid 410157096: 새상품 230 아디다스 x 클랏 슈퍼스타 코어 블랙 클라우드 화이트 / raw=shoe-clot-adidas-superstar / current=shoe-clot-adidas-superstar / dbKey=shoe|adidas_superstar|sneaker|a_grade / currentKey=shoe|adidas_superstar|sneaker|s_grade / pool=ready / flags=db_key_differs_from_raw_reparse,db_key_differs_from_current_catalog_reparse,db_clean_but_current_catalog_changes_key,pool_exposed_with_catalog_or_parser_drift,shoe_product_type_defaulted_to_sneaker
- pid 410228291: 아디다스 웨일즈보너 삼바 포니 블랙 260 / raw=shoe-adidas-samba-wales-bonner / current=shoe-adidas-samba-wales-bonner / dbKey=shoe|samba_wales_bonner|sneaker|a_grade / currentKey=shoe|samba_wales_bonner|sneaker|s_grade / pool=ready / flags=db_key_differs_from_raw_reparse,db_key_differs_from_current_catalog_reparse,db_clean_but_current_catalog_changes_key,pool_exposed_with_catalog_or_parser_drift,shoe_product_type_defaulted_to_sneaker
- pid 406381391: 미즈노 알파 재팬  265mm 새제품 / raw=shoe-mizuno-alpha / current=shoe-mizuno-alpha-japan / dbKey=shoe|alpha|sneaker|a_grade / currentKey=shoe|alpha_japan|sneaker|a_grade / pool=ready / flags=raw_sku_differs_from_current_catalog,db_key_differs_from_current_catalog_reparse,db_clean_but_current_catalog_changes_key,pool_exposed_with_catalog_or_parser_drift,shoe_product_type_defaulted_to_sneaker
- pid 394099132: 아식스 x 세실리에 반센 젤 큐물러스 16 블랙 옐로우 / raw=shoe-asics-cecilie-bahnsen-collab / current=shoe-asics-cecilie-bahnsen-collab / dbKey=shoe|asics_cecilie_bahnsen_collab|sneaker|b_grade / currentKey=shoe|asics_cecilie_bahnsen_collab|sneaker|a_grade / pool=ready / flags=db_key_differs_from_raw_reparse,db_key_differs_from_current_catalog_reparse,db_clean_but_current_catalog_changes_key,pool_exposed_with_catalog_or_parser_drift,shoe_product_type_defaulted_to_sneaker
- pid 408988269: 나이키 에어맥스95 흰파남 빅버블 / raw=shoe-nike-airmax-95 / current=shoe-nike-airmax-95 / dbKey=shoe|airmax_95|sneaker|a_grade|with_box / currentKey=shoe|airmax_95|sneaker|s_grade|with_box / pool=ready / flags=db_key_differs_from_raw_reparse,db_key_differs_from_current_catalog_reparse,db_clean_but_current_catalog_changes_key,pool_exposed_with_catalog_or_parser_drift,shoe_unknown_size
- pid 358117074: 피어오브갓/ 캘리포니아 뮬 카나리/ 43 / raw=shoe-fog-fear-of-god-self / current=shoe-fog-fear-of-god-self / dbKey=shoe|fear_of_god_self|sneaker|a_grade / currentKey=shoe|fear_of_god_self|sneaker|s_grade / pool=ready / flags=db_key_differs_from_raw_reparse,db_key_differs_from_current_catalog_reparse,db_clean_but_current_catalog_changes_key,pool_exposed_with_catalog_or_parser_drift,shoe_product_type_defaulted_to_sneaker
- pid 188467560: (270) 나이키 스투시 에어 포스 1 미드 블랙 / raw=shoe-stussy-nike-collab / current=shoe-stussy-nike-collab / dbKey=shoe|stussy_nike_collab|sneaker|a_grade / currentKey=shoe|stussy_nike_collab|sneaker|s_grade / pool=ready / flags=db_key_differs_from_raw_reparse,db_key_differs_from_current_catalog_reparse,db_clean_but_current_catalog_changes_key,pool_exposed_with_catalog_or_parser_drift,shoe_product_type_defaulted_to_sneaker
- pid 387518782: 아디다스 삼바 OG 스포티앤리치 265 / raw=shoe-adidas-samba-sporty-rich / current=shoe-adidas-samba-sporty-rich / dbKey=shoe|samba_sporty_rich|sneaker|a_grade / currentKey=shoe|samba_sporty_rich|sneaker|s_grade / pool=ready / flags=db_key_differs_from_raw_reparse,db_key_differs_from_current_catalog_reparse,db_clean_but_current_catalog_changes_key,pool_exposed_with_catalog_or_parser_drift,shoe_product_type_defaulted_to_sneaker
- pid 405305859: [260]나이키x리바이스 에어조던3 데님세일 짐레드 / raw=shoe-nike-levis-collab / current=shoe-nike-levis-collab / dbKey=shoe|nike_levis_collab|sneaker|b_grade / currentKey=shoe|nike_levis_collab|sneaker|a_grade / pool=ready / flags=db_key_differs_from_raw_reparse,db_key_differs_from_current_catalog_reparse,db_clean_but_current_catalog_changes_key,pool_exposed_with_catalog_or_parser_drift,shoe_row_has_clothing_terms
- pid 397695730: 몽클레르 마야 쇼트 다운 자켓 / raw=clothing-moncler-maya / current=clothing-moncler-maya / dbKey=clothing|moncler_maya|down_jacket|a_grade / currentKey=clothing|moncler_maya|down_jacket|b_grade / pool=ready / flags=db_key_differs_from_raw_reparse,db_key_differs_from_current_catalog_reparse,db_clean_but_current_catalog_changes_key,pool_exposed_with_catalog_or_parser_drift
- pid 288127680: 반스 올드스쿨 그린애쉬 민트 - 240  VANS oldskool / raw=shoe-vans-old-skool / current=shoe-vans-old-skool / dbKey=shoe|old_skool|sneaker|b_grade / currentKey=shoe|old_skool|sneaker|a_grade / pool=ready / flags=db_key_differs_from_raw_reparse,db_key_differs_from_current_catalog_reparse,db_clean_but_current_catalog_changes_key,pool_exposed_with_catalog_or_parser_drift
- pid 375116228: [250] 나이키 (W) 에어맥스1 CMFT PRM TAPE / raw=shoe-nike-airmax-1 / current=shoe-nike-airmax-1 / dbKey=shoe|airmax_1|sneaker|b_grade / currentKey=shoe|airmax_1|sneaker|a_grade / pool=ready / flags=db_key_differs_from_raw_reparse,db_key_differs_from_current_catalog_reparse,db_clean_but_current_catalog_changes_key,pool_exposed_with_catalog_or_parser_drift

## Read
- Production ready/reserved fashion rows are on the latest parser versions, so this is not an old-parser deploy lag issue.
- The next operational risk is smaller and more concrete: the ready/reserved pool still contains rows whose stored comparable key or raw SKU no longer matches the current parser/catalog result.
- `shoe_unknown_condition` and `shoe_product_type_defaulted_to_sneaker` are signal-quality audit queues, not automatic invalidation criteria yet.

## Deferred
- No DB mutation in this wave. If confirmed, next step is a no-write reclassification plan for stale fashion `sku_id` rows, then a capped apply/backfill.
- Catalog/parser patches should be driven by the top flagged samples rather than broad hand edits.
- Pool gate or mass invalidation remains deferred until the report is reviewed.

## Artifacts
- `reports/fashion-shoe-db-sweep-latest.json`
- `reports/fashion-shoe-db-sweep-latest.md`
