# Category Readiness Report

- generated_at: 2026-05-10T09:57:46.944Z
- source rows limit: 8000

| category | gate | rows | parse ready | critical unknown | market trusted keys | recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| smartphone | internal_only | 60 | 55/60 (91.7%) | 5 (8.3%) | 8 (high 1, medium 7) | keep_internal: 표본 100건 미만 |
| tablet | internal_only | 0 | 0/0 (0%) | 0 (0%) | 0 (high 0, medium 0) | keep_internal: 표본 100건 미만 |
| laptop | internal_only | 194 | 127/194 (65.5%) | 119 (61.3%) | 4 (high 1, medium 3) | keep_internal: 옵션 파서 통과율 75% 미만 |

## smartphone

### Top Comparable Keys
| key | count |
| --- | --- |
| iphone|iphone_14|128gb | 7 |
| iphone|iphone_15|128gb | 5 |
| iphone|iphone_13|128gb | 4 |
| galaxy_s|galaxy_s23|256gb | 4 |
| iphone|iphone_16|128gb | 3 |
| iphone|iphone_15_pro|256gb | 3 |
| iphone|iphone_16|256gb | 3 |
| galaxy_s|galaxy_s24|512gb | 3 |
| iphone|iphone_16e|128gb | 2 |
| iphone|iphone_15_pro_max|256gb | 2 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_storage | 5 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 381326248 | 아이폰16e(화이트) 배터리 성능 95 | iPhone 16e | 550,000 | iphone|iphone_16e|unknown_storage | 0.55 | - | unknown_storage |
| 274084654 | [삼성전자/통신사/삼케플]갤럭시S24울트라 | Galaxy S24 Ultra | 557,800 | galaxy_s|galaxy_s24_ultra|unknown_storage | 0.45 | - | unknown_storage |
| 405025592 | 갤럭시 s22, s23 ,S24, S25, S26 울트라 대여해드립니다 | Galaxy S23 Ultra | 250,000 | galaxy_s|galaxy_s23_ultra|unknown_storage | 0.45 | - | unknown_storage |
| 342959651 | 아이폰13프로맥스 | iPhone 13 Pro Max | 7,000 | iphone|iphone_13_pro_max|unknown_storage | 0.45 | - | unknown_storage |
| 406839823 | 푸마 수원삼성 갤럭시 S23 반팔 유니폼 | Galaxy S23 | 65,000 | galaxy_s|galaxy_s23|unknown_storage | 0.45 | - | unknown_storage |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407202833 | 아이폰 15 128GB 블랙 | iPhone 15 | 530,000 | iphone|iphone_15|128gb | 0.85 | medium | 539,000 |
| 406448319 | 아이폰 15 128gb 블랙 | iPhone 15 | 530,000 | iphone|iphone_15|128gb | 0.75 | medium | 539,000 |
| 366836373 | [미개봉] 아이폰16 128기가 | iPhone 16 | 1,019,000 | iphone|iphone_16|128gb | 0.8 | medium | 765,000 |
| 406362413 | 아이폰15핑크 128기가 | iPhone 15 | 550,000 | iphone|iphone_15|128gb | 0.85 | medium | 539,000 |
| 287927513 | 아이폰15/128GB[APPLE] | iPhone 15 | 343,000 | iphone|iphone_15|128gb | 0.75 | medium | 539,000 |

### High Risk Parser Examples
| pid | issue | name | key |
| --- | --- | --- | --- |
| 407202833 | condition:low_battery_health | 아이폰 15 128GB 블랙 | iphone|iphone_15|128gb |
| 406638655 | condition:cosmetic_wear,refurbished_or_repaired | 아이폰 15프로 256 블랙티타늄 자급제 | iphone|iphone_15_pro|256gb |
| 391462954 | condition:good_condition,repair_or_defect_signal | 아이폰14 블랙 128기가 | iphone|iphone_14|128gb |
| 407191428 | condition:cosmetic_wear,low_battery_health | 아이폰 14 퍼플 128GB | iphone|iphone_14|128gb |
| 406362413 | condition:good_condition,cosmetic_wear,repair_or_defect_signal | 아이폰15핑크 128기가 | iphone|iphone_15|128gb |

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
| macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 7 |
| macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 5 |
| macbook|macbook_pro|m1|14in|16gb_ram|512gb_ssd | 4 |
| macbook|macbook_air|m5|13in|16gb_ram|512gb_ssd | 4 |
| macbook|macbook_pro|m5|14in|24gb_ram|1024gb_ssd | 3 |
| macbook|macbook_pro|i7|15in|16gb_ram|512gb_ssd | 3 |
| macbook|macbook_air|m2|13in|16gb_ram|256gb_ssd | 3 |
| macbook|macbook_air|m3|15in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_air|i7|13in|8gb_ram|256gb_ssd | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_ram | 55 |
| unknown_ssd | 40 |
| unknown_chip | 24 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407186043 | [상태 최상급 보장] 애플 맥북프로 노트북 M1 14인치 실버 | MacBook Pro | 1,350,000 | macbook|macbook_pro|m1|14in|16gb_ram|unknown_ssd | 0.91 | - | unknown_ssd |
| 404476018 | 맥북 에어 m2 | MacBook Air | 950,000 | macbook|macbook_air|m2|13in|unknown_ram|unknown_ssd | 0.77 | - | unknown_ram, unknown_ssd |
| 402419165 | 맥북에어 13인치 A1466 2015 256기가 팝니다 | MacBook Air | 240,000 | macbook|macbook_air|unknown_chip|13in|unknown_ram|256gb_ssd | 0.7300000000000001 | - | unknown_chip, unknown_ram |
| 406988620 | 맥북프로 16인치 M1pro 32메모리 512GB 배터리88% | MacBook Pro | 1,480,000 | macbook|macbook_pro|m1_pro|16in|unknown_ram|512gb_ssd | 0.9600000000000001 | - | unknown_ram |
| 407168152 | 실사용 가능 애플 맥북 프로 레티나 13인치 2015 | MacBook Pro | 80,000 | macbook|macbook_pro|unknown_chip|13in|unknown_ram|121gb_ssd | 0.7300000000000001 | - | unknown_chip, unknown_ram |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 405193626 | 애플 맥북 에어 13 M5 미드나이트 512GB | MacBook Air | 1,500,000 | macbook|macbook_air|m5|13in|16gb_ram|512gb_ssd | 1 | medium | 1,560,000 |
| 406800348 | (배터리94) 맥북 에어 m1 13인치 8 256 | MacBook Air | 600,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | high | 550,000 |
| 407180247 | (미개봉)애플 맥북 에어 13 M5 실버 512GB | MacBook Air | 1,590,000 | macbook|macbook_air|m5|13in|16gb_ram|512gb_ssd | 1 | medium | 1,560,000 |
| 354789789 | 애플 맥북 에어 M2 2022 실버 256GB | MacBook Air | 940,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 800,000 |
| 407218307 | 맥북 에어 M1 2020 8GB 실버 | MacBook Air | 550,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | high | 550,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.
