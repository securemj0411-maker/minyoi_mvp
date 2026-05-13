# Category Readiness Report

- generated_at: 2026-05-12T10:17:34.113Z
- source rows limit: 2000

| category | gate | rows | parse ready | critical unknown | market trusted keys | recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| smartphone | internal_only | 227 | 215/227 (94.7%) | 12 (5.3%) | 17 (high 4, medium 13) | keep_internal: 고위험 샘플 검수 필요 |
| laptop | internal_only | 109 | 39/109 (35.8%) | 115 (105.5%) | 0 (high 0, medium 0) | keep_internal: 옵션 파서 통과율 75% 미만 |

## smartphone

### Top Comparable Keys
| key | count |
| --- | --- |
| galaxy_s|galaxy_s25|256gb | 36 |
| galaxy_s|galaxy_s23|256gb | 32 |
| galaxy_s|galaxy_s24|256gb | 20 |
| galaxy_s|galaxy_s24_plus|256gb | 15 |
| iphone|iphone_14|128gb | 11 |
| iphone|iphone_15|128gb | 9 |
| galaxy_s|galaxy_s25_plus|256gb | 9 |
| iphone|iphone_16_pro|256gb | 6 |
| iphone|iphone_15_pro|128gb | 5 |
| galaxy_s|galaxy_s24_plus|512gb | 4 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_storage | 12 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407590238 | 갤럭시 s24+ 실버화이트 | Galaxy S24 Plus | 520,000 | galaxy_s|galaxy_s24_plus|unknown_storage | 0.45 | - | unknown_storage |
| 407601372 | 삼성 갤럭시 S24+ 골드 풀박스 | Galaxy S24 Plus | 450,000 | galaxy_s|galaxy_s24_plus|unknown_storage | 0.45 | - | unknown_storage |
| 407608244 | 아이폰 16 프로 | iPhone 16 Pro | 1,070,000 | iphone|iphone_16_pro|unknown_storage | 0.45 | - | unknown_storage |
| 407580959 | 갤럭시 S25 울트라 1테라 | Galaxy S25 Ultra | 1,100,000 | galaxy_s|galaxy_s25_ultra|unknown_storage | 0.5 | - | unknown_storage |
| 407578483 | 아이폰15프로맥스 1T 화이트티타늄 SS급! 풀박스 | iPhone 15 Pro Max | 1,210,000 | iphone|iphone_15_pro_max|unknown_storage | 0.55 | - | unknown_storage |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407584698 | (6092)갤럭시s25 256 s급 판매합니다 | Galaxy S25 | 710,000 | galaxy_s|galaxy_s25|256gb | 0.75 | medium | 710,000 |
| 407586118 | 갤럭시s25 256 s급 판매합니다 | Galaxy S25 | 710,000 | galaxy_s|galaxy_s25|256gb | 0.75 | medium | 710,000 |
| 407586460 | 갤럭시s24 256 판매합니다 | Galaxy S24 | 435,000 | galaxy_s|galaxy_s24|256gb | 0.75 | medium | 465,000 |
| 407586635 | (6464)갤럭시s25 256 s급 판매합니다 | Galaxy S25 | 730,000 | galaxy_s|galaxy_s25|256gb | 0.75 | medium | 710,000 |
| 407587693 | (3800)갤럭시s24플러스 256 판매합니다 | Galaxy S24 Plus | 469,000 | galaxy_s|galaxy_s24_plus|256gb | 0.75 | medium | 520,000 |

### High Risk Parser Examples
| pid | issue | name | key |
| --- | --- | --- | --- |
| 407600137 | condition:cosmetic_wear,repair_or_defect_signal,refurbished_or_repaired | [리퍼급]갤럭시S24 최상급컨디션 256G 화이트 공기계 중고폰 | galaxy_s|galaxy_s24|256gb |
| 407601372 | condition:new_or_open_box,full_set,good_condition,display_defect | 삼성 갤럭시 S24+ 골드 풀박스 | galaxy_s|galaxy_s24_plus|unknown_storage |
| 407610829 | condition:good_condition,low_battery_health,camera_issue | (a급)아이폰 14 128g 판매 | iphone|iphone_14|128gb |
| 407609248 | condition:new_or_open_box,refurbished_or_repaired | 아이폰 15 프로 256 내추럴 티타늄 리퍼 미사용 (애케플 6/3까지) | iphone|iphone_15_pro|256gb |
| 407608082 | condition:cosmetic_wear,repair_or_defect_signal,refurbished_or_repaired | [리퍼급]갤럭시S23 최상급컨디션 256G 라벤더 공기계 중고폰 | galaxy_s|galaxy_s23|256gb |

## laptop

### Top Comparable Keys
| key | count |
| --- | --- |
| macbook|macbook_pro|2021y|m1_max|16in|32gb_ram|1024gb_ssd | 12 |
| macbook|macbook_air|unknown_generation|m5|13in|unknown_ram|unknown_ssd | 3 |
| macbook|macbook_air|2020y|unknown_chip|13in|unknown_ram|unknown_ssd | 3 |
| macbook|macbook_air|unknown_generation|m2|13in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_air|2025y|m4|15in|16gb_ram|256gb_ssd | 2 |
| macbook|macbook_pro|unknown_generation|m5_pro|16in|24gb_ram|1024gb_ssd | 2 |
| macbook|macbook_pro|2018y|i7|15in|16gb_ram|unknown_ssd | 2 |
| macbook|macbook_air|2020y|i3|13in|8gb_ram|256gb_ssd | 2 |
| macbook|macbook_pro|unknown_generation|m5|14in|24gb_ram|1024gb_ssd | 2 |
| macbook|macbook_pro|a1398|intel|15in|unknown_ram|unknown_ssd | 2 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_generation | 48 |
| unknown_ram | 29 |
| unknown_ssd | 26 |
| unknown_chip | 12 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407584539 | 맥북프로 16인치 M4 24gb 512ssd 스페이스 그레이 | MacBook Pro | 2,600,000 | macbook|macbook_pro|unknown_generation|m4|16in|24gb_ram|512gb_ssd | 1 | - | unknown_generation |
| 407591897 | 맥북프로 2016년 터치바 13인치 | MacBook Pro | 230,000 | macbook|macbook_pro|2016y|unknown_chip|13in|unknown_ram|unknown_ssd | 0.7100000000000001 | - | unknown_chip, unknown_ram, unknown_ssd |
| 407598729 | 애플 맥북 에어 2013 실버 | MacBook Air | 100,000 | macbook|macbook_air|2013y|unknown_chip|13in|unknown_ram|unknown_ssd | 0.7100000000000001 | - | unknown_chip, unknown_ram, unknown_ssd |
| 407611908 | (미개봉) 맥북 프로 m4 14인치 16gb 1tb 팝니다. | MacBook Pro | 2,200,000 | macbook|macbook_pro|unknown_generation|m4|14in|16gb_ram|1024gb_ssd | 1 | - | unknown_generation |
| 407614938 | 맥북프로m4 16인치 24gb 1tb | MacBook Pro | 2,980,000 | macbook|macbook_pro|unknown_generation|m4|16in|24gb_ram|1024gb_ssd | 1 | - | unknown_generation |

### Trusted Examples
No trusted examples yet.

### High Risk Parser Examples
No high-risk parser examples found in this sample.
