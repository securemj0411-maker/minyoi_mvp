# Category Readiness Report

- generated_at: 2026-05-10T10:07:28.430Z
- source rows limit: 8000

| category | gate | rows | parse ready | critical unknown | market trusted keys | recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| smartphone | internal_only | 109 | 95/109 (87.2%) | 14 (12.8%) | 11 (high 0, medium 11) | keep_internal: 고위험 샘플 검수 필요 |
| tablet | internal_only | 7 | 3/7 (42.9%) | 6 (85.7%) | 0 (high 0, medium 0) | keep_internal: 표본 100건 미만 |
| laptop | internal_only | 184 | 120/184 (65.2%) | 117 (63.6%) | 4 (high 1, medium 3) | keep_internal: 옵션 파서 통과율 75% 미만 |

## smartphone

### Top Comparable Keys
| key | count |
| --- | --- |
| iphone|iphone_15_pro_max|256gb | 8 |
| iphone|iphone_14|128gb | 8 |
| iphone|iphone_15|128gb | 7 |
| galaxy_s|galaxy_s23|256gb | 6 |
| galaxy_s|galaxy_s24_plus|256gb | 5 |
| iphone|iphone_13|128gb | 5 |
| iphone|iphone_16_pro_max|256gb | 5 |
| iphone|iphone_16|128gb | 4 |
| iphone|iphone_15_pro|256gb | 4 |
| iphone|iphone_16|256gb | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_storage | 14 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 406815800 | 아이폰 15 프로맥스 뒷판 (셀프수리) 화이트 새상품 | iPhone 15 Pro Max | 18,000 | iphone|iphone_15_pro_max|unknown_storage | 0.45 | - | unknown_storage |
| 381326248 | 아이폰16e(화이트) 배터리 성능 95 | iPhone 16e | 550,000 | iphone|iphone_16e|unknown_storage | 0.55 | - | unknown_storage |
| 274084654 | [삼성전자/통신사/삼케플]갤럭시S24울트라 | Galaxy S24 Ultra | 557,800 | galaxy_s|galaxy_s24_ultra|unknown_storage | 0.45 | - | unknown_storage |
| 407064978 | 아이폰16프로맥스 데저트티타늄과 색상교환하실분 | iPhone 16 Pro Max | 1,400,000 | iphone|iphone_16_pro_max|unknown_storage | 0.45 | - | unknown_storage |
| 406592693 | 애플 아이폰 13 배터리효울 85% | iPhone 13 | 380,000 | iphone|iphone_13|unknown_storage | 0.55 | - | unknown_storage |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407014670 | 아이폰 16 128GB 울트라마린 미개봉 자급제 | iPhone 16 | 910,000 | iphone|iphone_16|128gb | 0.8 | medium | 765,000 |
| 402405001 | 갤럭시 S23 특S급 24.6.28 | Galaxy S23 | 450,000 | galaxy_s|galaxy_s23|256gb | 0.75 | medium | 360,000 |
| 362327305 | 아이폰15프로맥스 미개봉 자급제 새제품 판매합니다. | iPhone 15 Pro Max | 1,450,000 | iphone|iphone_15_pro_max|256gb | 0.8 | medium | 1,015,000 |
| 403233737 | (3906)갤럭시s24플러스 256 판매합니다 | Galaxy S24 Plus | 469,000 | galaxy_s|galaxy_s24_plus|256gb | 0.75 | medium | 485,000 |
| 406436021 | 아이폰 15 팝니다 | iPhone 15 | 575,000 | iphone|iphone_15|128gb | 0.85 | medium | 539,000 |

### High Risk Parser Examples
| pid | issue | name | key |
| --- | --- | --- | --- |
| 406778252 | condition:cosmetic_wear,low_battery_health | 아이폰 15 프로(pro) 256GB | iphone|iphone_15_pro|256gb |
| 406968725 | condition:full_set,good_condition,cosmetic_wear,repair_or_defect_signal,refurbished_or_repaired | 아이폰16 256gb 틸 | iphone|iphone_16|256gb |
| 402405001 | condition:good_condition,locked_or_lost_signal | 갤럭시 S23 특S급 24.6.28 | galaxy_s|galaxy_s23|256gb |
| 406815800 | condition:new_or_open_box,repair_or_defect_signal | 아이폰 15 프로맥스 뒷판 (셀프수리) 화이트 새상품 | iphone|iphone_15_pro_max|unknown_storage |
| 403874847 | condition:good_condition,cosmetic_wear,display_defect | 아이폰 15 프로 128GB 실버 | iphone|iphone_15_pro|128gb |

## tablet

### Top Comparable Keys
| key | count |
| --- | --- |
| ipad|ipad_mini|8_3in|64gb|wifi | 2 |
| ipad|ipad_mini|8_3in|32gb|unknown_connectivity | 1 |
| ipad|ipad_air|unknown_screen|unknown_storage|unknown_connectivity | 1 |
| ipad|ipad_pro|unknown_screen|32gb|wifi | 1 |
| ipad|ipad_pro|unknown_screen|64gb|cellular | 1 |
| ipad|ipad_pro|11in|128gb|wifi | 1 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_screen | 3 |
| unknown_connectivity | 2 |
| unknown_storage | 1 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 295689481 | 아이패드 미니 1세대 A1432 32기가 | iPad mini | 40,000 | ipad|ipad_mini|8_3in|32gb|unknown_connectivity | 0.8 | - | unknown_connectivity |
| 390420317 | 아이패드 에어2 가격제안 주세요 | iPad Air | 70,000 | ipad|ipad_air|unknown_screen|unknown_storage|unknown_connectivity | 0.45 | - | unknown_screen, unknown_storage, unknown_connectivity |
| 396190424 | 아이패드 프로9.7 32G WIFI 실버,그레이 10대! | iPad Pro | 120,000 | ipad|ipad_pro|unknown_screen|32gb|wifi | 0.8 | - | unknown_screen |
| 403270417 | 아이패드프로 12.9 2세대 64g 셀룰러 풀세트 | iPad Pro | 270,000 | ipad|ipad_pro|unknown_screen|64gb|cellular | 0.8 | - | unknown_screen |

### Trusted Examples
No trusted examples yet.

### High Risk Parser Examples
| pid | issue | name | key |
| --- | --- | --- | --- |
| 396190424 | condition:good_condition,repair_or_defect_signal | 아이패드 프로9.7 32G WIFI 실버,그레이 10대! | ipad|ipad_pro|unknown_screen|32gb|wifi |
| 397192954 | condition:cosmetic_wear,repair_or_defect_signal | 아이패드 미니3 64기가 | ipad|ipad_mini|8_3in|64gb|wifi |

## laptop

### Top Comparable Keys
| key | count |
| --- | --- |
| macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 6 |
| macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 6 |
| macbook|macbook_pro|m1|14in|16gb_ram|512gb_ssd | 5 |
| macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 4 |
| macbook|macbook_pro|m4_pro|16in|24gb_ram|512gb_ssd | 3 |
| macbook|macbook_air|m4|15in|unknown_ram|unknown_ssd | 3 |
| macbook|macbook_air|m2|15in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_pro|i9|16in|16gb_ram|1024gb_ssd | 3 |
| macbook|macbook_pro|m2|13in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_air|m5|13in|16gb_ram|512gb_ssd | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_ram | 56 |
| unknown_ssd | 40 |
| unknown_chip | 21 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 406021612 | 애플 맥북 프로 16인치 M3 Max 실버 with 애플케어플러스 | MacBook Pro | 3,724,000 | macbook|macbook_pro|m3_max|16in|unknown_ram|unknown_ssd | 0.8200000000000001 | - | unknown_ram, unknown_ssd |
| 405859760 | 맥북 프로 14인치 M2 Pro 16GB 실버 | MacBook Pro | 1,600,000 | macbook|macbook_pro|m2_pro|14in|16gb_ram|unknown_ssd | 0.91 | - | unknown_ssd |
| 401583147 | 맥북 에어 15 M4 실버 | MacBook Air | 1,800,000 | macbook|macbook_air|m4|15in|unknown_ram|unknown_ssd | 0.77 | - | unknown_ram, unknown_ssd |
| 402568641 | 맥북에어 M5 15인치 모델 | MacBook Air | 1,990,000 | macbook|macbook_air|m5|15in|unknown_ram|512gb_ssd | 0.91 | - | unknown_ram |
| 406077099 | 맥북프로14 M5 (미개봉) | MacBook Pro | 2,100,000 | macbook|macbook_pro|m5|14in|unknown_ram|unknown_ssd | 0.77 | - | unknown_ram, unknown_ssd |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407180247 | (미개봉)애플 맥북 에어 13 M5 실버 512GB | MacBook Air | 1,590,000 | macbook|macbook_air|m5|13in|16gb_ram|512gb_ssd | 1 | medium | 1,560,000 |
| 407020054 | 맥북에어 13인치 m2 8/256 | MacBook Air | 650,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 800,000 |
| 403205378 | 맥북 프로 13인치 노트북 a1502 (2014) 인텔 코어 i5 | MacBook Pro | 140,000 | macbook|macbook_pro|i5|13in|8gb_ram|256gb_ssd | 1 | medium | 355,000 |
| 311429468 | [336]2017 맥북 프로 13 i5/8GB/256GB Fair급 | MacBook Pro | 320,000 | macbook|macbook_pro|i5|13in|8gb_ram|256gb_ssd | 1 | medium | 355,000 |
| 407218307 | 맥북 에어 M1 2020 8GB 실버 | MacBook Air | 550,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | high | 550,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.
