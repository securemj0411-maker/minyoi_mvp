# Category Readiness Report

- generated_at: 2026-05-10T10:13:08.132Z
- source rows limit: 8000

| category | gate | rows | parse ready | critical unknown | market trusted keys | recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| smartphone | internal_only | 83 | 77/83 (92.8%) | 6 (7.2%) | 11 (high 0, medium 11) | keep_internal: 표본 100건 미만 |
| tablet | internal_only | 23 | 19/23 (82.6%) | 4 (17.4%) | 0 (high 0, medium 0) | keep_internal: 표본 100건 미만 |
| laptop | internal_only | 201 | 132/201 (65.7%) | 120 (59.7%) | 4 (high 1, medium 3) | keep_internal: 옵션 파서 통과율 75% 미만 |

## smartphone

### Top Comparable Keys
| key | count |
| --- | --- |
| iphone|iphone_15|128gb | 7 |
| iphone|iphone_14|128gb | 7 |
| iphone|iphone_13|128gb | 5 |
| galaxy_s|galaxy_s23|256gb | 5 |
| iphone|iphone_15_pro|256gb | 4 |
| iphone|iphone_15_pro_max|256gb | 4 |
| iphone|iphone_14_pro|256gb | 4 |
| galaxy_s|galaxy_s24_plus|256gb | 3 |
| galaxy_s|galaxy_s24|256gb | 3 |
| iphone|iphone_15|256gb | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_storage | 6 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407064978 | 아이폰16프로맥스 데저트티타늄과 색상교환하실분 | iPhone 16 Pro Max | 1,400,000 | iphone|iphone_16_pro_max|unknown_storage | 0.45 | - | unknown_storage |
| 274084654 | [삼성전자/통신사/삼케플]갤럭시S24울트라 | Galaxy S24 Ultra | 557,800 | galaxy_s|galaxy_s24_ultra|unknown_storage | 0.45 | - | unknown_storage |
| 406815800 | 아이폰 15 프로맥스 뒷판 (셀프수리) 화이트 새상품 | iPhone 15 Pro Max | 18,000 | iphone|iphone_15_pro_max|unknown_storage | 0.45 | - | unknown_storage |
| 381326248 | 아이폰16e(화이트) 배터리 성능 95 | iPhone 16e | 550,000 | iphone|iphone_16e|unknown_storage | 0.55 | - | unknown_storage |
| 405025592 | 갤럭시 s22, s23 ,S24, S25, S26 울트라 대여해드립니다 | Galaxy S23 Ultra | 250,000 | galaxy_s|galaxy_s23_ultra|unknown_storage | 0.45 | - | unknown_storage |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407158607 | 갤럭시S23 512G 무잔상 중고폰 공기계 | Galaxy S23 | 340,000 | galaxy_s|galaxy_s23|512gb | 0.75 | medium | 360,000 |
| 287927513 | 아이폰15/128GB[APPLE] | iPhone 15 | 343,000 | iphone|iphone_15|128gb | 0.75 | medium | 539,000 |
| 407191428 | 아이폰 14 퍼플 128GB | iPhone 14 | 370,000 | iphone|iphone_14|128gb | 0.85 | medium | 418,190 |
| 394131875 | 아이폰13 128G 미개봉새제품(블랙,화이트) | iPhone 13 | 480,000 | iphone|iphone_13|128gb | 0.75 | medium | 340,000 |
| 406824593 | 아이폰 14 화이트  128GB 스타라이트 | iPhone 14 | 430,000 | iphone|iphone_14|128gb | 0.85 | medium | 418,190 |

### High Risk Parser Examples
| pid | issue | name | key |
| --- | --- | --- | --- |
| 407191428 | condition:cosmetic_wear,low_battery_health | 아이폰 14 퍼플 128GB | iphone|iphone_14|128gb |
| 406824593 | condition:repair_or_defect_signal,low_battery_health,screen_replaced | 아이폰 14 화이트  128GB 스타라이트 | iphone|iphone_14|128gb |
| 407184980 | condition:new_or_open_box,refurbished_or_repaired | 새제품 아이폰14블랙128기가 | iphone|iphone_14|128gb |
| 407155322 | condition:good_condition,cosmetic_wear,repair_or_defect_signal,carrier_status_disclosed | 갤럭시S23 특SS급 256g 서울s23 부산s23 강원s23 파주s23 | galaxy_s|galaxy_s23|256gb |
| 406815800 | condition:new_or_open_box,repair_or_defect_signal | 아이폰 15 프로맥스 뒷판 (셀프수리) 화이트 새상품 | iphone|iphone_15_pro_max|unknown_storage |

## tablet

### Top Comparable Keys
| key | count |
| --- | --- |
| ipad|ipad_mini|8_3in|64gb|wifi | 3 |
| ipad|ipad_pro|11in|128gb|wifi | 3 |
| ipad|ipad_air|10_9in|64gb|wifi | 2 |
| ipad|ipad_mini|7_9in|64gb|wifi | 2 |
| ipad|ipad_pro|13in|256gb|wifi | 2 |
| ipad|ipad_pro|12_9in|128gb|wifi | 1 |
| ipad|ipad_air|10_5in|64gb|wifi | 1 |
| ipad|ipad_mini|8_3in|128gb|wifi | 1 |
| ipad|ipad_mini|7_9in|64gb|cellular | 1 |
| ipad|ipad_pro|11in|unknown_storage|wifi | 1 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_storage | 4 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 406863067 | 아이패드 프로 11 3세대 M1 | iPad Pro | 550,000 | ipad|ipad_pro|11in|unknown_storage|wifi | 0.6900000000000001 | - | unknown_storage |
| 399888403 | 애플 아이패드 미니 2 | iPad mini | 370,000 | ipad|ipad_mini|7_9in|unknown_storage|wifi | 0.6900000000000001 | - | unknown_storage |
| 396078208 | ipad mini 7 wifi (애케플) | iPad mini | 630,000 | ipad|ipad_mini|8_3in|unknown_storage|wifi | 0.7400000000000001 | - | unknown_storage |
| 405450379 | 아이패드 에어 4세대 실버 | iPad Air | 320,000 | ipad|ipad_air|10_9in|unknown_storage|wifi | 0.6900000000000001 | - | unknown_storage |

### Trusted Examples
No trusted examples yet.

### High Risk Parser Examples
| pid | issue | name | key |
| --- | --- | --- | --- |
| 405624488 | condition:cosmetic_wear,repair_or_defect_signal | 아이패드 에어5세대 64GB | ipad|ipad_air|10_9in|64gb|wifi |
| 406127551 | condition:good_condition,cosmetic_wear,repair_or_defect_signal,low_battery_health,locked_or_lost_signal | 아이패드 에어 3 애플팬슬 1세대 | ipad|ipad_air|10_5in|64gb|wifi |
| 395262676 | condition:refurbished_or_repaired | 아이패드 미니6(배터리100) | ipad|ipad_mini|8_3in|64gb|wifi |
| 396078208 | condition:new_or_open_box,cosmetic_wear,repair_or_defect_signal | ipad mini 7 wifi (애케플) | ipad|ipad_mini|8_3in|unknown_storage|wifi |
| 405450379 | condition:cosmetic_wear,repair_or_defect_signal | 아이패드 에어 4세대 실버 | ipad|ipad_air|10_9in|unknown_storage|wifi |

## laptop

### Top Comparable Keys
| key | count |
| --- | --- |
| macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 8 |
| macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 7 |
| macbook|macbook_pro|m1|14in|16gb_ram|512gb_ssd | 5 |
| macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 4 |
| macbook|macbook_air|m2|13in|16gb_ram|256gb_ssd | 4 |
| macbook|macbook_air|m2|15in|8gb_ram|256gb_ssd | 4 |
| macbook|macbook_air|m4|15in|16gb_ram|256gb_ssd | 4 |
| macbook|macbook_pro|m5|14in|24gb_ram|1024gb_ssd | 3 |
| macbook|macbook_air|m5|13in|16gb_ram|512gb_ssd | 3 |
| macbook|macbook_pro|m2|13in|8gb_ram|256gb_ssd | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_ram | 56 |
| unknown_ssd | 44 |
| unknown_chip | 20 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 380541339 | 맥북에어 A1370 | MacBook Air | 150,000 | macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 0.5900000000000001 | - | unknown_chip, unknown_ram, unknown_ssd |
| 404476018 | 맥북 에어 m2 | MacBook Air | 950,000 | macbook|macbook_air|m2|13in|unknown_ram|unknown_ssd | 0.77 | - | unknown_ram, unknown_ssd |
| 407168152 | 실사용 가능 애플 맥북 프로 레티나 13인치 2015 | MacBook Pro | 80,000 | macbook|macbook_pro|unknown_chip|13in|unknown_ram|121gb_ssd | 0.7300000000000001 | - | unknown_chip, unknown_ram |
| 406201752 | 맥북프로 고급형 I7 CPU 1테라 하드 | MacBook Pro | 300,000 | macbook|macbook_pro|i7|unknown_screen|unknown_ram|unknown_ssd | 0.63 | - | unknown_ram, unknown_ssd |
| 403829715 | 맥북 에어 M4 15인치 미드나이트 | MacBook Air | 1,500,000 | macbook|macbook_air|m4|15in|unknown_ram|unknown_ssd | 0.77 | - | unknown_ram, unknown_ssd |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407020054 | 맥북에어 13인치 m2 8/256 | MacBook Air | 650,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 800,000 |
| 405193626 | 애플 맥북 에어 13 M5 미드나이트 512GB | MacBook Air | 1,500,000 | macbook|macbook_air|m5|13in|16gb_ram|512gb_ssd | 1 | medium | 1,560,000 |
| 407231746 | 맥북 에어m1 로즈골드 | MacBook Air | 580,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | high | 550,000 |
| 403205378 | 맥북 프로 13인치 노트북 a1502 (2014) 인텔 코어 i5 | MacBook Pro | 140,000 | macbook|macbook_pro|i5|13in|8gb_ram|256gb_ssd | 1 | medium | 355,000 |
| 354789789 | 애플 맥북 에어 M2 2022 실버 256GB | MacBook Air | 940,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 800,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.
