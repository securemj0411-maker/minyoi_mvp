# Category Readiness Report

- generated_at: 2026-05-10T09:44:09.829Z
- source rows limit: 6000

| category | gate | rows | parse ready | critical unknown | market trusted keys | recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| smartphone | internal_only | 73 | 69/73 (94.5%) | 4 (5.5%) | 10 (high 2, medium 8) | keep_internal: 표본 100건 미만 |
| tablet | internal_only | 0 | 0/0 (0%) | 0 (0%) | 0 (high 0, medium 0) | keep_internal: 표본 100건 미만 |
| laptop | internal_only | 168 | 118/168 (70.2%) | 90 (53.6%) | 2 (high 1, medium 1) | keep_internal: 옵션 파서 통과율 75% 미만 |

## smartphone

### Top Comparable Keys
| key | count |
| --- | --- |
| iphone|iphone_14|128gb | 7 |
| galaxy_s|galaxy_s23|256gb | 7 |
| iphone|iphone_15|128gb | 6 |
| galaxy_s|galaxy_s24|256gb | 5 |
| galaxy_s|galaxy_s24|512gb | 5 |
| iphone|iphone_15|256gb | 4 |
| galaxy_s|galaxy_s24_plus|256gb | 4 |
| iphone|iphone_16|256gb | 4 |
| galaxy_s|galaxy_s23|512gb | 3 |
| iphone|iphone_15_pro|256gb | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_storage | 4 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 381326248 | 아이폰16e(화이트) 배터리 성능 95 | iPhone 16e | 550,000 | iphone|iphone_16e|unknown_storage | 0.55 | - | unknown_storage |
| 405025592 | 갤럭시 s22, s23 ,S24, S25, S26 울트라 대여해드립니다 | Galaxy S23 Ultra | 250,000 | galaxy_s|galaxy_s23_ultra|unknown_storage | 0.45 | - | unknown_storage |
| 274084654 | [삼성전자/통신사/삼케플]갤럭시S24울트라 | Galaxy S24 Ultra | 557,800 | galaxy_s|galaxy_s24_ultra|unknown_storage | 0.45 | - | unknown_storage |
| 406839823 | 푸마 수원삼성 갤럭시 S23 반팔 유니폼 | Galaxy S23 | 65,000 | galaxy_s|galaxy_s23|unknown_storage | 0.45 | - | unknown_storage |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 406448319 | 아이폰 15 128gb 블랙 | iPhone 15 | 530,000 | iphone|iphone_15|128gb | 0.75 | medium | 544,500 |
| 407158607 | 갤럭시S23 512G 무잔상 중고폰 공기계 | Galaxy S23 | 340,000 | galaxy_s|galaxy_s23|512gb | 0.75 | medium | 360,000 |
| 395476698 | 아이폰15 256기가 블랙 (특S급) / 0307 | iPhone 15 | 710,000 | iphone|iphone_15|256gb | 0.75 | medium | 630,000 |
| 407155322 | 갤럭시S23 특SS급 256g 서울s23 부산s23 강원s23 파주s23 | Galaxy S23 | 399,000 | galaxy_s|galaxy_s23|256gb | 0.8 | high | 353,500 |
| 399803946 | 갤럭시S24플러스 256기가 옐로우 (무잔상) / 0404 | Galaxy S24 Plus | 470,000 | galaxy_s|galaxy_s24_plus|256gb | 0.75 | medium | 492,000 |

### High Risk Parser Examples
| pid | issue | name | key |
| --- | --- | --- | --- |
| 407225339 | condition:cosmetic_wear,repair_or_defect_signal,screen_replaced,carrier_status_disclosed | 아이폰 14 128 팝니다! | iphone|iphone_14|128gb |
| 381326248 | condition:cosmetic_wear,repair_or_defect_signal | 아이폰16e(화이트) 배터리 성능 95 | iphone|iphone_16e|unknown_storage |
| 406099044 | condition:cosmetic_wear,display_defect | 아이폰 15프로 256기가 화이트티타늄 | iphone|iphone_15_pro|256gb |
| 407155322 | condition:good_condition,cosmetic_wear,repair_or_defect_signal,carrier_status_disclosed | 갤럭시S23 특SS급 256g 서울s23 부산s23 강원s23 파주s23 | galaxy_s|galaxy_s23|256gb |
| 407060066 | condition:good_condition,cosmetic_wear,repair_or_defect_signal | 갤럭시 S24+ 플러스 256GB 블랙 팔아요 | galaxy_s|galaxy_s24_plus|256gb |

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
| macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 7 |
| macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 6 |
| macbook|macbook_air|m5|13in|16gb_ram|512gb_ssd | 5 |
| macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 5 |
| macbook|macbook_air|m2|13in|16gb_ram|256gb_ssd | 4 |
| macbook|macbook_pro|m1|14in|16gb_ram|512gb_ssd | 3 |
| macbook|macbook_pro|m5|14in|24gb_ram|1024gb_ssd | 3 |
| macbook|macbook_pro|i9|16in|16gb_ram|1024gb_ssd | 3 |
| macbook|macbook_air|i7|13in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_air|m3|15in|8gb_ram|256gb_ssd | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_ram | 42 |
| unknown_ssd | 32 |
| unknown_chip | 16 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407186043 | [상태 최상급 보장] 애플 맥북프로 노트북 M1 14인치 실버 | MacBook Pro | 1,350,000 | macbook|macbook_pro|m1|14in|16gb_ram|unknown_ssd | 0.91 | - | unknown_ssd |
| 402419165 | 맥북에어 13인치 A1466 2015 256기가 팝니다 | MacBook Air | 240,000 | macbook|macbook_air|unknown_chip|13in|unknown_ram|256gb_ssd | 0.7300000000000001 | - | unknown_chip, unknown_ram |
| 405255061 | 맥북프로13인치 m1 256gb | MacBook Pro | 660,000 | macbook|macbook_pro|m1|13in|unknown_ram|256gb_ssd | 0.91 | - | unknown_ram |
| 406265769 | 맥북 프로 M1 13인치 스페이스 그레이 S급 팝니다. | MacBook Pro | 780,000 | macbook|macbook_pro|m1|13in|unknown_ram|unknown_ssd | 0.77 | - | unknown_ram, unknown_ssd |
| 406941155 | 맥북프로 A1707 15.6 인치 판매 합니다 - 500기가 SSD | MacBook Pro | 450,000 | macbook|macbook_pro|unknown_chip|15_6in|unknown_ram|500gb_ssd | 0.7800000000000001 | - | unknown_chip, unknown_ram |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407020054 | 맥북에어 13인치 m2 8/256 | MacBook Air | 650,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 825,000 |
| 407231746 | 맥북 에어m1 로즈골드 | MacBook Air | 580,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | high | 550,000 |
| 407187580 | 맥북에어13 M2 노트북 | MacBook Air | 750,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 825,000 |
| 317588724 | 맥북에어 M1 2021 로즈골드 상태최상 하자 없음 | MacBook Air | 600,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | high | 550,000 |
| 406800348 | (배터리94) 맥북 에어 m1 13인치 8 256 | MacBook Air | 600,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | high | 550,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.
