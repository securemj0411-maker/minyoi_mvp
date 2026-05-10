# Category Readiness Report

- generated_at: 2026-05-10T10:21:16.313Z
- source rows limit: 8000

| category | gate | rows | parse ready | critical unknown | market trusted keys | recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| smartphone | internal_only | 84 | 79/84 (94%) | 5 (6%) | 11 (high 0, medium 11) | keep_internal: 표본 100건 미만 |
| tablet | internal_only | 13 | 11/13 (84.6%) | 2 (15.4%) | 0 (high 0, medium 0) | keep_internal: 표본 100건 미만 |
| laptop | internal_only | 174 | 118/174 (67.8%) | 101 (58%) | 4 (high 1, medium 3) | keep_internal: 옵션 파서 통과율 75% 미만 |

## smartphone

### Top Comparable Keys
| key | count |
| --- | --- |
| iphone|iphone_15|128gb | 7 |
| iphone|iphone_14|128gb | 7 |
| galaxy_s|galaxy_s23|256gb | 7 |
| iphone|iphone_13|128gb | 5 |
| iphone|iphone_15_pro|256gb | 4 |
| iphone|iphone_15_pro_max|256gb | 4 |
| iphone|iphone_14_pro|256gb | 4 |
| iphone|iphone_15_pro_max|512gb | 3 |
| iphone|iphone_15|256gb | 3 |
| galaxy_s|galaxy_s24|256gb | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_storage | 5 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 274084654 | [삼성전자/통신사/삼케플]갤럭시S24울트라 | Galaxy S24 Ultra | 557,800 | galaxy_s|galaxy_s24_ultra|unknown_storage | 0.45 | - | unknown_storage |
| 381326248 | 아이폰16e(화이트) 배터리 성능 95 | iPhone 16e | 550,000 | iphone|iphone_16e|unknown_storage | 0.55 | - | unknown_storage |
| 401839624 | 갤럭시 S24 울트라 | Galaxy S24 Ultra | 750,000 | galaxy_s|galaxy_s24_ultra|unknown_storage | 0.45 | - | unknown_storage |
| 342959651 | 아이폰13프로맥스 | iPhone 13 Pro Max | 7,000 | iphone|iphone_13_pro_max|unknown_storage | 0.45 | - | unknown_storage |
| 316185052 | 뮤즈무드 아이폰15프로 | iPhone 15 Pro | 14,000 | iphone|iphone_15_pro|unknown_storage | 0.45 | - | unknown_storage |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 394131875 | 아이폰13 128G 미개봉새제품(블랙,화이트) | iPhone 13 | 480,000 | iphone|iphone_13|128gb | 0.75 | medium | 340,000 |
| 333118477 | 아이폰 13 미드나이트 128GB | iPhone 13 | 410,000 | iphone|iphone_13|128gb | 0.75 | medium | 340,000 |
| 407158607 | 갤럭시S23 512G 무잔상 중고폰 공기계 | Galaxy S23 | 340,000 | galaxy_s|galaxy_s23|512gb | 0.75 | medium | 360,000 |
| 287928673 | 아이폰15/128GB[APPLE] | iPhone 15 | 198,800 | iphone|iphone_15|128gb | 0.75 | medium | 539,000 |
| 392272518 | 아이폰13 핑크 128GB 스마트폰 | iPhone 13 | 195,000 | iphone|iphone_13|128gb | 0.8 | medium | 340,000 |

### High Risk Parser Examples
| pid | issue | name | key |
| --- | --- | --- | --- |
| 404115263 | condition:display_defect,carrier_status_disclosed | 아이폰 15프로 256 화이트 | iphone|iphone_15_pro|256gb |
| 407184980 | condition:new_or_open_box,refurbished_or_repaired | 새제품 아이폰14블랙128기가 | iphone|iphone_14|128gb |
| 407225339 | condition:cosmetic_wear,repair_or_defect_signal,screen_replaced,carrier_status_disclosed | 아이폰 14 128 팝니다! | iphone|iphone_14|128gb |
| 407191428 | condition:cosmetic_wear,low_battery_health | 아이폰 14 퍼플 128GB | iphone|iphone_14|128gb |
| 407202833 | condition:low_battery_health | 아이폰 15 128GB 블랙 | iphone|iphone_15|128gb |

## tablet

### Top Comparable Keys
| key | count |
| --- | --- |
| ipad|ipad_mini|8_3in|64gb|wifi | 2 |
| ipad|ipad_air|10_9in|64gb|wifi | 2 |
| ipad|ipad_pro|11in|128gb|wifi | 2 |
| ipad|ipad_pro|13in|256gb|cellular | 1 |
| ipad|ipad_mini|7_9in|32gb|wifi | 1 |
| ipad|ipad_mini|8_3in|128gb|wifi | 1 |
| ipad|ipad_pro|12_9in|64gb|cellular | 1 |
| ipad|ipad_mini|7_9in|unknown_storage|wifi | 1 |
| ipad|ipad_pro|13in|256gb|wifi | 1 |
| ipad|ipad_mini|8_3in|unknown_storage|wifi | 1 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_storage | 2 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 399888403 | 애플 아이패드 미니 2 | iPad mini | 370,000 | ipad|ipad_mini|7_9in|unknown_storage|wifi | 0.6900000000000001 | - | unknown_storage |
| 396078208 | ipad mini 7 wifi (애케플) | iPad mini | 630,000 | ipad|ipad_mini|8_3in|unknown_storage|wifi | 0.7400000000000001 | - | unknown_storage |

### Trusted Examples
No trusted examples yet.

### High Risk Parser Examples
No high-risk parser examples found in this sample.

## laptop

### Top Comparable Keys
| key | count |
| --- | --- |
| macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 6 |
| macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 6 |
| macbook|macbook_pro|m1|14in|16gb_ram|512gb_ssd | 5 |
| macbook|macbook_air|m2|15in|8gb_ram|256gb_ssd | 4 |
| macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_pro|m2|13in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_air|m2|13in|16gb_ram|256gb_ssd | 3 |
| macbook|macbook_air|m3|15in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_pro|i5|13in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_pro|i9|16in|16gb_ram|1024gb_ssd | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_ram | 48 |
| unknown_ssd | 36 |
| unknown_chip | 17 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 380541339 | 맥북에어 A1370 | MacBook Air | 150,000 | macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 0.5900000000000001 | - | unknown_chip, unknown_ram, unknown_ssd |
| 407182934 | 맥북에어 2018 박스포함 | MacBook Air | 210,000 | macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 0.5900000000000001 | - | unknown_chip, unknown_ram, unknown_ssd |
| 407177317 | 맥북에어 2015 11인치 a1465 메인보드 | MacBook Air | 55,000 | macbook|macbook_air|i5|11in|unknown_ram|unknown_ssd | 0.77 | - | unknown_ram, unknown_ssd |
| 403801042 | 맥북 프로 m5 24램 1테라 | MacBook Pro | 2,400,000 | macbook|macbook_pro|m5|14in|unknown_ram|unknown_ssd | 0.77 | - | unknown_ram, unknown_ssd |
| 404476018 | 맥북 에어 m2 | MacBook Air | 950,000 | macbook|macbook_air|m2|13in|unknown_ram|unknown_ssd | 0.77 | - | unknown_ram, unknown_ssd |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407020054 | 맥북에어 13인치 m2 8/256 | MacBook Air | 650,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 800,000 |
| 407231746 | 맥북 에어m1 로즈골드 | MacBook Air | 580,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | high | 550,000 |
| 311429468 | [336]2017 맥북 프로 13 i5/8GB/256GB Fair급 | MacBook Pro | 320,000 | macbook|macbook_pro|i5|13in|8gb_ram|256gb_ssd | 1 | medium | 355,000 |
| 407187580 | 맥북에어13 M2 노트북 | MacBook Air | 750,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 800,000 |
| 405193626 | 애플 맥북 에어 13 M5 미드나이트 512GB | MacBook Air | 1,500,000 | macbook|macbook_air|m5|13in|16gb_ram|512gb_ssd | 1 | medium | 1,560,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.
