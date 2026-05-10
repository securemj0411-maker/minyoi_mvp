# Category Readiness Report

- generated_at: 2026-05-10T09:30:23.511Z
- source rows limit: 6000

| category | gate | rows | parse ready | critical unknown | market trusted keys | recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| smartphone | internal_only | 43 | 43/43 (100%) | 0 (0%) | 10 (high 2, medium 8) | keep_internal: 표본 100건 미만 |
| tablet | internal_only | 0 | 0/0 (0%) | 0 (0%) | 0 (high 0, medium 0) | keep_internal: 표본 100건 미만 |
| laptop | internal_only | 169 | 121/169 (71.6%) | 78 (46.2%) | 2 (high 1, medium 1) | keep_internal: 옵션 파서 통과율 75% 미만 |

## smartphone

### Top Comparable Keys
| key | count |
| --- | --- |
| iphone|iphone_15|128gb | 7 |
| galaxy_s|galaxy_s24_plus|256gb | 6 |
| iphone|iphone_13|128gb | 4 |
| iphone|iphone_16|128gb | 3 |
| galaxy_s|galaxy_s23|256gb | 3 |
| galaxy_s|galaxy_s24|512gb | 3 |
| iphone|iphone_15_pro|256gb | 3 |
| iphone|iphone_15|256gb | 3 |
| galaxy_s|galaxy_s23|512gb | 2 |
| iphone|iphone_16|256gb | 2 |

### Critical Unknowns
No critical unknowns.

### Needs Review Examples
No needs-review examples.

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407202833 | 아이폰 15 128GB 블랙 | iPhone 15 | 530,000 | iphone|iphone_15|128gb | 0.85 | medium | 544,500 |
| 366836373 | [미개봉] 아이폰16 128기가 | iPhone 16 | 1,019,000 | iphone|iphone_16|128gb | 0.8 | medium | 765,000 |
| 333118477 | 아이폰 13 미드나이트 128GB | iPhone 13 | 410,000 | iphone|iphone_13|128gb | 0.75 | medium | 330,000 |
| 407155322 | 갤럭시S23 특SS급 256g 서울s23 부산s23 강원s23 파주s23 | Galaxy S23 | 399,000 | galaxy_s|galaxy_s23|256gb | 0.8 | high | 353,500 |
| 407158607 | 갤럭시S23 512G 무잔상 중고폰 공기계 | Galaxy S23 | 340,000 | galaxy_s|galaxy_s23|512gb | 0.75 | medium | 360,000 |

### High Risk Parser Examples
| pid | issue | name | key |
| --- | --- | --- | --- |
| 407202833 | condition:low_battery_health | 아이폰 15 128GB 블랙 | iphone|iphone_15|128gb |
| 407155322 | condition:good_condition,cosmetic_wear,repair_or_defect_signal,carrier_status_disclosed | 갤럭시S23 특SS급 256g 서울s23 부산s23 강원s23 파주s23 | galaxy_s|galaxy_s23|256gb |
| 392272518 | condition:cosmetic_wear,repair_or_defect_signal | 아이폰13 핑크 128GB 스마트폰 | iphone|iphone_13|128gb |
| 404115263 | condition:display_defect,carrier_status_disclosed | 아이폰 15프로 256 화이트 | iphone|iphone_15_pro|256gb |
| 406638655 | condition:cosmetic_wear,refurbished_or_repaired | 아이폰 15프로 256 블랙티타늄 자급제 | iphone|iphone_15_pro|256gb |

## tablet

### Top Comparable Keys
| key | count |
| --- | --- |

### Critical Unknowns
No critical unknowns.

### Needs Review Examples
No needs-review examples.

### Trusted Examples
No trusted examples yet.

### High Risk Parser Examples
No high-risk parser examples found in this sample.

## laptop

### Top Comparable Keys
| key | count |
| --- | --- |
| macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 8 |
| macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 4 |
| macbook|macbook_pro|i9|16in|16gb_ram|1024gb_ssd | 4 |
| macbook|macbook_pro|i7|15in|16gb_ram|512gb_ssd | 4 |
| macbook|macbook_pro|i5|13in|8gb_ram|256gb_ssd | 4 |
| macbook|macbook_air|m2|13in|16gb_ram|256gb_ssd | 3 |
| macbook|macbook_air|m3|15in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_pro|m1|14in|16gb_ram|512gb_ssd | 3 |
| macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 3 |
| macbook|macbook_air|m4|13in|16gb_ram|512gb_ssd | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_ram | 37 |
| unknown_ssd | 28 |
| unknown_chip | 13 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 393652405 | 맥북프로 Mid 2012 13인치 ssd 250기가 램 6기가 | MacBook Pro | 110,000 | macbook|macbook_pro|i5|13in|unknown_ram|250gb_ssd | 0.91 | - | unknown_ram |
| 406642377 | 드디어 팝니다!!!@@@ 집에서만 사용한!! 애플 맥북 에어 2015 | MacBook Air | 170,000 | macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 0.5900000000000001 | - | unknown_chip, unknown_ram, unknown_ssd |
| 403801042 | 맥북 프로 m5 24램 1테라 | MacBook Pro | 2,400,000 | macbook|macbook_pro|m5|14in|unknown_ram|unknown_ssd | 0.77 | - | unknown_ram, unknown_ssd |
| 347044332 | [535]2019 맥북 프로 16 i9/16GB/1T Good급 | MacBook Pro | 650,000 | macbook|macbook_pro|i9|16in|16gb_ram|unknown_ssd | 0.91 | - | unknown_ssd |
| 407160553 | 맥북프로 M3 16인치 실버 | MacBook Pro | 2,450,000 | macbook|macbook_pro|m3|16in|unknown_ram|unknown_ssd | 0.77 | - | unknown_ram, unknown_ssd |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407187580 | 맥북에어13 M2 노트북 | MacBook Air | 770,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 825,000 |
| 407218307 | 맥북 에어 M1 2020 8GB 실버 | MacBook Air | 550,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | high | 550,000 |
| 407051026 | 맥북에어 m1 | MacBook Air | 650,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | high | 550,000 |
| 406800348 | (배터리94) 맥북 에어 m1 13인치 8 256 | MacBook Air | 600,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | high | 550,000 |
| 407020054 | 맥북에어 13인치 m2 8/256 | MacBook Air | 650,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 825,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.
