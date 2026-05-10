# Category Readiness Report

- generated_at: 2026-05-10T10:17:35.643Z
- source rows limit: 8000

| category | gate | rows | parse ready | critical unknown | market trusted keys | recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| smartphone | internal_only | 110 | 96/110 (87.3%) | 14 (12.7%) | 11 (high 0, medium 11) | keep_internal: 고위험 샘플 검수 필요 |
| tablet | internal_only | 21 | 19/21 (90.5%) | 2 (9.5%) | 0 (high 0, medium 0) | keep_internal: 표본 100건 미만 |
| laptop | internal_only | 183 | 120/183 (65.6%) | 117 (63.9%) | 4 (high 1, medium 3) | keep_internal: 옵션 파서 통과율 75% 미만 |

## smartphone

### Top Comparable Keys
| key | count |
| --- | --- |
| iphone|iphone_14|128gb | 8 |
| iphone|iphone_15|128gb | 7 |
| iphone|iphone_15_pro_max|256gb | 7 |
| galaxy_s|galaxy_s23|256gb | 7 |
| iphone|iphone_13|128gb | 5 |
| iphone|iphone_16_pro_max|256gb | 5 |
| galaxy_s|galaxy_s24_plus|256gb | 4 |
| iphone|iphone_15_pro|256gb | 4 |
| iphone|iphone_16|128gb | 4 |
| iphone|iphone_15|256gb | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_storage | 14 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 406815800 | 아이폰 15 프로맥스 뒷판 (셀프수리) 화이트 새상품 | iPhone 15 Pro Max | 18,000 | iphone|iphone_15_pro_max|unknown_storage | 0.45 | - | unknown_storage |
| 274084654 | [삼성전자/통신사/삼케플]갤럭시S24울트라 | Galaxy S24 Ultra | 557,800 | galaxy_s|galaxy_s24_ultra|unknown_storage | 0.45 | - | unknown_storage |
| 405025592 | 갤럭시 s22, s23 ,S24, S25, S26 울트라 대여해드립니다 | Galaxy S23 Ultra | 250,000 | galaxy_s|galaxy_s23_ultra|unknown_storage | 0.45 | - | unknown_storage |
| 407064978 | 아이폰16프로맥스 데저트티타늄과 색상교환하실분 | iPhone 16 Pro Max | 1,400,000 | iphone|iphone_16_pro_max|unknown_storage | 0.45 | - | unknown_storage |
| 381326248 | 아이폰16e(화이트) 배터리 성능 95 | iPhone 16e | 550,000 | iphone|iphone_16e|unknown_storage | 0.55 | - | unknown_storage |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407191428 | 아이폰 14 퍼플 128GB | iPhone 14 | 370,000 | iphone|iphone_14|128gb | 0.85 | medium | 418,190 |
| 407184980 | 새제품 아이폰14블랙128기가 | iPhone 14 | 590,000 | iphone|iphone_14|128gb | 0.75 | medium | 418,190 |
| 394214130 | 아이폰15 256기가 블랙 (특S급) / 0307 | iPhone 15 | 710,000 | iphone|iphone_15|256gb | 0.75 | medium | 630,000 |
| 287928673 | 아이폰15/128GB[APPLE] | iPhone 15 | 198,800 | iphone|iphone_15|128gb | 0.75 | medium | 539,000 |
| 254336053 | [Apple]아이폰15프로맥스 256기가 미개봉제품 판매합니다. | iPhone 15 Pro Max | 492,000 | iphone|iphone_15_pro_max|256gb | 0.75 | medium | 1,015,000 |

### High Risk Parser Examples
| pid | issue | name | key |
| --- | --- | --- | --- |
| 407191428 | condition:cosmetic_wear,low_battery_health | 아이폰 14 퍼플 128GB | iphone|iphone_14|128gb |
| 407184980 | condition:new_or_open_box,refurbished_or_repaired | 새제품 아이폰14블랙128기가 | iphone|iphone_14|128gb |
| 406815800 | condition:new_or_open_box,repair_or_defect_signal | 아이폰 15 프로맥스 뒷판 (셀프수리) 화이트 새상품 | iphone|iphone_15_pro_max|unknown_storage |
| 407202833 | condition:low_battery_health | 아이폰 15 128GB 블랙 | iphone|iphone_15|128gb |
| 406824593 | condition:repair_or_defect_signal,low_battery_health,screen_replaced | 아이폰 14 화이트  128GB 스타라이트 | iphone|iphone_14|128gb |

## tablet

### Top Comparable Keys
| key | count |
| --- | --- |
| ipad|ipad_mini|8_3in|64gb|wifi | 3 |
| ipad|ipad_pro|11in|128gb|wifi | 3 |
| ipad|ipad_air|10_9in|64gb|wifi | 2 |
| ipad|ipad_mini|8_3in|128gb|wifi | 2 |
| ipad|ipad_pro|12_9in|128gb|wifi | 2 |
| ipad|ipad_mini|7_9in|32gb|wifi | 1 |
| ipad|ipad_pro|12_9in|64gb|cellular | 1 |
| ipad|ipad_mini|7_9in|unknown_storage|wifi | 1 |
| ipad|ipad_air|11in|128gb|wifi | 1 |
| ipad|ipad_pro|11in|128gb|cellular | 1 |

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
| pid | issue | name | key |
| --- | --- | --- | --- |
| 397192954 | condition:cosmetic_wear,repair_or_defect_signal | 아이패드 미니3 64기가 | ipad|ipad_mini|7_9in|64gb|wifi |

## laptop

### Top Comparable Keys
| key | count |
| --- | --- |
| macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 8 |
| macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 6 |
| macbook|macbook_pro|m1|14in|16gb_ram|512gb_ssd | 5 |
| macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 4 |
| macbook|macbook_air|m2|15in|8gb_ram|256gb_ssd | 4 |
| macbook|macbook_air|m2|13in|16gb_ram|256gb_ssd | 3 |
| macbook|macbook_air|i5|11in|unknown_ram|unknown_ssd | 3 |
| macbook|macbook_pro|m2|13in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_air|m3|15in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_pro|m4_pro|16in|24gb_ram|512gb_ssd | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_ram | 55 |
| unknown_ssd | 40 |
| unknown_chip | 22 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 404476018 | 맥북 에어 m2 | MacBook Air | 950,000 | macbook|macbook_air|m2|13in|unknown_ram|unknown_ssd | 0.77 | - | unknown_ram, unknown_ssd |
| 404291865 | 맥북프로 2015 15인치 cto 모델 | MacBook Pro | 260,000 | macbook|macbook_pro|unknown_chip|15in|16gb_ram|512gb_ssd | 0.8700000000000001 | - | unknown_chip |
| 407177317 | 맥북에어 2015 11인치 a1465 메인보드 | MacBook Air | 55,000 | macbook|macbook_air|i5|11in|unknown_ram|unknown_ssd | 0.77 | - | unknown_ram, unknown_ssd |
| 393652405 | 맥북프로 Mid 2012 13인치 ssd 250기가 램 6기가 | MacBook Pro | 110,000 | macbook|macbook_pro|i5|13in|unknown_ram|250gb_ssd | 0.91 | - | unknown_ram |
| 407186043 | [상태 최상급 보장] 애플 맥북프로 노트북 M1 14인치 실버 | MacBook Pro | 1,350,000 | macbook|macbook_pro|m1|14in|16gb_ram|unknown_ssd | 0.91 | - | unknown_ssd |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407180247 | (미개봉)애플 맥북 에어 13 M5 실버 512GB | MacBook Air | 1,590,000 | macbook|macbook_air|m5|13in|16gb_ram|512gb_ssd | 1 | medium | 1,560,000 |
| 405193626 | 애플 맥북 에어 13 M5 미드나이트 512GB | MacBook Air | 1,500,000 | macbook|macbook_air|m5|13in|16gb_ram|512gb_ssd | 1 | medium | 1,560,000 |
| 407218307 | 맥북 에어 M1 2020 8GB 실버 | MacBook Air | 550,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | high | 550,000 |
| 407020054 | 맥북에어 13인치 m2 8/256 | MacBook Air | 650,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 800,000 |
| 317588724 | 맥북에어 M1 2021 로즈골드 상태최상 하자 없음 | MacBook Air | 600,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | high | 550,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.
