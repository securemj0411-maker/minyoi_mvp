# Category Readiness Report

- generated_at: 2026-05-10T10:24:24.748Z
- source rows limit: 8000

| category | gate | rows | parse ready | critical unknown | market trusted keys | recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| smartphone | internal_only | 80 | 76/80 (95%) | 4 (5%) | 12 (high 0, medium 12) | keep_internal: 표본 100건 미만 |
| tablet | internal_only | 20 | 17/20 (85%) | 3 (15%) | 1 (high 0, medium 1) | keep_internal: 표본 100건 미만 |
| laptop | internal_only | 160 | 116/160 (72.5%) | 78 (48.8%) | 4 (high 1, medium 3) | keep_internal: 옵션 파서 통과율 75% 미만 |

## smartphone

### Top Comparable Keys
| key | count |
| --- | --- |
| iphone|iphone_14|128gb | 7 |
| iphone|iphone_15|128gb | 7 |
| galaxy_s|galaxy_s23|256gb | 6 |
| iphone|iphone_13|128gb | 5 |
| iphone|iphone_15_pro|256gb | 4 |
| iphone|iphone_15_pro_max|256gb | 4 |
| iphone|iphone_15_pro_max|512gb | 3 |
| iphone|iphone_16_pro_max|512gb | 3 |
| iphone|iphone_15|256gb | 3 |
| galaxy_s|galaxy_s24_plus|256gb | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_storage | 4 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 274084654 | [삼성전자/통신사/삼케플]갤럭시S24울트라 | Galaxy S24 Ultra | 557,800 | galaxy_s|galaxy_s24_ultra|unknown_storage | 0.45 | - | unknown_storage |
| 381326248 | 아이폰16e(화이트) 배터리 성능 95 | iPhone 16e | 550,000 | iphone|iphone_16e|unknown_storage | 0.55 | - | unknown_storage |
| 342959651 | 아이폰13프로맥스 | iPhone 13 Pro Max | 7,000 | iphone|iphone_13_pro_max|unknown_storage | 0.45 | - | unknown_storage |
| 316185052 | 뮤즈무드 아이폰15프로 | iPhone 15 Pro | 14,000 | iphone|iphone_15_pro|unknown_storage | 0.45 | - | unknown_storage |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407191428 | 아이폰 14 퍼플 128GB | iPhone 14 | 370,000 | iphone|iphone_14|128gb | 0.85 | medium | 418,190 |
| 402485896 | 갤럭시S24울트라(s928) 512기가 팝니다 | Galaxy S24 Ultra | 908,000 | galaxy_s|galaxy_s24_ultra|512gb | 0.75 | medium | 830,000 |
| 394131875 | 아이폰13 128G 미개봉새제품(블랙,화이트) | iPhone 13 | 480,000 | iphone|iphone_13|128gb | 0.75 | medium | 340,000 |
| 288885950 | 갤럭시S24/256GB[삼성전자] | Galaxy S24 | 88,980 | galaxy_s|galaxy_s24|256gb | 0.75 | medium | 450,000 |
| 391462954 | 아이폰14 블랙 128기가 | iPhone 14 | 360,000 | iphone|iphone_14|128gb | 0.75 | medium | 418,190 |

### High Risk Parser Examples
| pid | issue | name | key |
| --- | --- | --- | --- |
| 407191428 | condition:cosmetic_wear,low_battery_health | 아이폰 14 퍼플 128GB | iphone|iphone_14|128gb |
| 407225339 | condition:cosmetic_wear,repair_or_defect_signal,screen_replaced,carrier_status_disclosed | 아이폰 14 128 팝니다! | iphone|iphone_14|128gb |
| 404115263 | condition:display_defect,carrier_status_disclosed | 아이폰 15프로 256 화이트 | iphone|iphone_15_pro|256gb |
| 407202833 | condition:low_battery_health | 아이폰 15 128GB 블랙 | iphone|iphone_15|128gb |
| 406824593 | condition:repair_or_defect_signal,low_battery_health,screen_replaced | 아이폰 14 화이트  128GB 스타라이트 | iphone|iphone_14|128gb |

## tablet

### Top Comparable Keys
| key | count |
| --- | --- |
| ipad|ipad_10|10_9in|64gb|wifi | 3 |
| ipad|ipad_air|10_9in|64gb|wifi | 2 |
| ipad|ipad_mini|8_3in|64gb|wifi | 2 |
| ipad|ipad_pro|11in|128gb|wifi | 2 |
| galaxy_tab|galaxy_tab_s8_plus|12_4in|256gb|wifi | 2 |
| galaxy_tab|galaxy_tab_s8_ultra|14_6in|256gb|wifi | 1 |
| galaxy_tab|galaxy_tab_s9|unknown_screen|128gb|wifi | 1 |
| ipad|ipad_pro|13in|256gb|cellular | 1 |
| ipad|ipad_mini|7_9in|32gb|wifi | 1 |
| ipad|ipad_mini|8_3in|128gb|wifi | 1 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_storage | 2 |
| unknown_screen | 1 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 403394715 | 삼성 갤럭시탭 S9 FE WiFi 128GB 그레이 | Galaxy Tab S9 | 420,000 | galaxy_tab|galaxy_tab_s9|unknown_screen|128gb|wifi | 0.8 | - | unknown_screen |
| 399888403 | 애플 아이패드 미니 2 | iPad mini | 370,000 | ipad|ipad_mini|7_9in|unknown_storage|wifi | 0.6900000000000001 | - | unknown_storage |
| 396078208 | ipad mini 7 wifi (애케플) | iPad mini | 630,000 | ipad|ipad_mini|8_3in|unknown_storage|wifi | 0.7400000000000001 | - | unknown_storage |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407048082 | 아이패드 미니 6세대 64GB + 애플펜슬 c타입 | iPad mini | 640,000 | ipad|ipad_mini|8_3in|64gb|wifi | 0.92 | medium | 450,000 |
| 395262676 | 아이패드 미니6(배터리100) | iPad mini | 450,000 | ipad|ipad_mini|8_3in|64gb|wifi | 0.9700000000000001 | medium | 450,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.

## laptop

### Top Comparable Keys
| key | count |
| --- | --- |
| macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 6 |
| macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 6 |
| macbook|macbook_pro|m1|14in|16gb_ram|512gb_ssd | 5 |
| macbook|macbook_pro|i5|13in|8gb_ram|256gb_ssd | 4 |
| macbook|macbook_air|m2|15in|8gb_ram|256gb_ssd | 4 |
| macbook|macbook_pro|m2|13in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_air|m3|15in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_air|m2|13in|16gb_ram|256gb_ssd | 3 |
| macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_air|m5|15in|16gb_ram|512gb_ssd | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_ram | 32 |
| unknown_ssd | 31 |
| unknown_chip | 15 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407186043 | [상태 최상급 보장] 애플 맥북프로 노트북 M1 14인치 실버 | MacBook Pro | 1,350,000 | macbook|macbook_pro|m1|14in|16gb_ram|unknown_ssd | 0.91 | - | unknown_ssd |
| 380541339 | 맥북에어 A1370 | MacBook Air | 150,000 | macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 0.5900000000000001 | - | unknown_chip, unknown_ram, unknown_ssd |
| 406265769 | 맥북 프로 M1 13인치 스페이스 그레이 S급 팝니다. | MacBook Pro | 850,000 | macbook|macbook_pro|m1|13in|unknown_ram|unknown_ssd | 0.77 | - | unknown_ram, unknown_ssd |
| 401601108 | 미개봉)맥북 에어 13 m5 512gb 스타라이트 | MacBook Air | 1,600,000 | macbook|macbook_air|m5|13in|unknown_ram|512gb_ssd | 0.91 | - | unknown_ram |
| 401961692 | 맥북 에어 MacBook Air / A1466 | MacBook Air | 192,000 | macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 0.5900000000000001 | - | unknown_chip, unknown_ram, unknown_ssd |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 354789789 | 애플 맥북 에어 M2 2022 실버 256GB | MacBook Air | 940,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 800,000 |
| 407187580 | 맥북에어13 M2 노트북 | MacBook Air | 750,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 800,000 |
| 407218307 | 맥북 에어 M1 2020 8GB 실버 | MacBook Air | 550,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | high | 550,000 |
| 407020054 | 맥북에어 13인치 m2 8/256 | MacBook Air | 650,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 800,000 |
| 405193626 | 애플 맥북 에어 13 M5 미드나이트 512GB | MacBook Air | 1,500,000 | macbook|macbook_air|m5|13in|16gb_ram|512gb_ssd | 1 | medium | 1,560,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.
