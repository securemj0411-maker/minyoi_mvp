# Category Readiness Report

- generated_at: 2026-05-10T09:37:56.992Z
- source rows limit: 6000

| category | gate | rows | parse ready | critical unknown | market trusted keys | recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| smartphone | internal_only | 72 | 69/72 (95.8%) | 3 (4.2%) | 10 (high 2, medium 8) | keep_internal: 표본 100건 미만 |
| tablet | internal_only | 0 | 0/0 (0%) | 0 (0%) | 0 (high 0, medium 0) | keep_internal: 표본 100건 미만 |
| laptop | internal_only | 182 | 124/182 (68.1%) | 101 (55.5%) | 2 (high 1, medium 1) | keep_internal: 옵션 파서 통과율 75% 미만 |

## smartphone

### Top Comparable Keys
| key | count |
| --- | --- |
| galaxy_s|galaxy_s24_plus|256gb | 8 |
| galaxy_s|galaxy_s23|256gb | 7 |
| iphone|iphone_15|128gb | 7 |
| galaxy_s|galaxy_s24|512gb | 6 |
| galaxy_s|galaxy_s24|256gb | 5 |
| iphone|iphone_16|128gb | 5 |
| iphone|iphone_16|256gb | 4 |
| iphone|iphone_13|128gb | 4 |
| galaxy_s|galaxy_s23|512gb | 3 |
| iphone|iphone_15_pro|256gb | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_storage | 3 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 406839823 | 푸마 수원삼성 갤럭시 S23 반팔 유니폼 | Galaxy S23 | 65,000 | galaxy_s|galaxy_s23|unknown_storage | 0.45 | - | unknown_storage |
| 274084654 | [삼성전자/통신사/삼케플]갤럭시S24울트라 | Galaxy S24 Ultra | 557,800 | galaxy_s|galaxy_s24_ultra|unknown_storage | 0.45 | - | unknown_storage |
| 405025592 | 갤럭시 s22, s23 ,S24, S25, S26 울트라 대여해드립니다 | Galaxy S23 Ultra | 250,000 | galaxy_s|galaxy_s23_ultra|unknown_storage | 0.45 | - | unknown_storage |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 401609914 | 갤럭시 S23 256GB 라벤더 팔아요 | Galaxy S23 | 720,000 | galaxy_s|galaxy_s23|256gb | 0.75 | high | 353,500 |
| 406925815 | 갤럭시s24플러스 256 판매합니다 | Galaxy S24 Plus | 492,000 | galaxy_s|galaxy_s24_plus|256gb | 0.75 | medium | 492,000 |
| 405631189 | 갤럭시s23 퍼플 512gb 정상해지 판매 | Galaxy S23 | 390,000 | galaxy_s|galaxy_s23|512gb | 0.75 | medium | 360,000 |
| 388050135 | 갤럭시s23 256GB 판매합니다! | Galaxy S23 | 380,000 | galaxy_s|galaxy_s23|256gb | 0.75 | high | 353,500 |
| 406898718 | 갤럭시 s24, 코발트 바이올렛, 라벤더, 256g | Galaxy S24 | 460,000 | galaxy_s|galaxy_s24|256gb | 0.75 | high | 456,000 |

### High Risk Parser Examples
| pid | issue | name | key |
| --- | --- | --- | --- |
| 406898718 | condition:cosmetic_wear,repair_or_defect_signal | 갤럭시 s24, 코발트 바이올렛, 라벤더, 256g | galaxy_s|galaxy_s24|256gb |
| 406638655 | condition:cosmetic_wear,refurbished_or_repaired | 아이폰 15프로 256 블랙티타늄 자급제 | iphone|iphone_15_pro|256gb |
| 406810632 | condition:repair_or_defect_signal,low_battery_health,refurbished_or_repaired,screen_replaced | 아이폰 15 핑크 256기가 | iphone|iphone_15|256gb |
| 407202833 | condition:low_battery_health | 아이폰 15 128GB 블랙 | iphone|iphone_15|128gb |
| 406099044 | condition:cosmetic_wear,display_defect | 아이폰 15프로 256기가 화이트티타늄 | iphone|iphone_15_pro|256gb |

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
| macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 9 |
| macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 6 |
| macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 5 |
| macbook|macbook_air|m2|13in|16gb_ram|256gb_ssd | 4 |
| macbook|macbook_air|m5|13in|16gb_ram|512gb_ssd | 4 |
| macbook|macbook_air|i7|13in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_air|m2|15in|8gb_ram|512gb_ssd | 3 |
| macbook|macbook_pro|unknown_chip|13in|unknown_ram|unknown_ssd | 3 |
| macbook|macbook_air|i5|13in|8gb_ram|512gb_ssd | 3 |
| macbook|macbook_air|m4|15in|16gb_ram|256gb_ssd | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_ram | 45 |
| unknown_ssd | 40 |
| unknown_chip | 16 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 404068790 | 맥북 에어 15인치 16GB 512 애케플 포함 | MacBook Air | 1,750,000 | macbook|macbook_air|unknown_chip|15in|16gb_ram|512gb_ssd | 0.8700000000000001 | - | unknown_chip |
| 406496522 | 급처!! ) 맥북프로 2019 터치바 13인치 모델 | MacBook Pro | 550,000 | macbook|macbook_pro|unknown_chip|13in|unknown_ram|unknown_ssd | 0.6400000000000001 | - | unknown_chip, unknown_ram, unknown_ssd |
| 404193563 | 맥북 에어 A1370 하이시에라 | MacBook Air | 105,000 | macbook|macbook_air|unknown_chip|11in|unknown_ram|unknown_ssd | 0.5900000000000001 | - | unknown_chip, unknown_ram, unknown_ssd |
| 404804240 | 맥북에어15 m5 16 1t 실버색상+애케플 팝니다 | MacBook Air | 2,050,000 | macbook|macbook_air|m5|15in|unknown_ram|unknown_ssd | 0.8200000000000001 | - | unknown_ram, unknown_ssd |
| 406368973 | 맥북 프로 13인치 2017 5 8GB 깔끔한 상태 / 바로사용가능 | MacBook Pro | 300,000 | macbook|macbook_pro|i5|13in|8gb_ram|unknown_ssd | 0.91 | - | unknown_ssd |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 404015934 | 맥북 에어m2 미드나이트 256기가 | MacBook Air | 850,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 825,000 |
| 404464510 | 맥북에어 m1 2020 256 | MacBook Air | 600,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | high | 550,000 |
| 406533745 | 맥북에어 m2 256gb 8gb 13인치 | MacBook Air | 750,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 825,000 |
| 403743826 | M1 맥북에어 기본형 | MacBook Air | 480,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | high | 550,000 |
| 407020054 | 맥북에어 13인치 m2 8/256 | MacBook Air | 650,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 825,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.
