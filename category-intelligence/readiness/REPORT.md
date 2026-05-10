# Category Readiness Report

- generated_at: 2026-05-10T09:21:27.246Z
- source rows limit: 6000

| category | gate | rows | parse ready | critical unknown | market trusted keys | recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| smartphone | internal_only | 46 | 44/46 (95.7%) | 2 (4.3%) | 9 (high 3, medium 6) | keep_internal: 표본 100건 미만 |
| laptop | internal_only | 180 | 127/180 (70.6%) | 85 (47.2%) | 2 (high 0, medium 2) | keep_internal: 옵션 파서 통과율 75% 미만 |

## smartphone

### Top Comparable Keys
| key | count |
| --- | --- |
| iphone|iphone_15|128gb | 6 |
| galaxy_s|galaxy_s23|256gb | 5 |
| iphone|iphone_16|128gb | 5 |
| iphone|iphone_15_pro|256gb | 4 |
| iphone|iphone_13|128gb | 4 |
| galaxy_s|galaxy_s24_plus|256gb | 4 |
| iphone|iphone_15|256gb | 3 |
| galaxy_s|galaxy_s24|256gb | 2 |
| iphone|iphone_16|256gb | 2 |
| galaxy_s|galaxy_s23|512gb | 2 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_storage | 2 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 274081619 | [풀박스/전색상]아이폰15 핑크색상 재입고 품절임박 번개톡 문의주세요 | iPhone 15 | 198,000 | iphone|iphone_15|unknown_storage | 0.45 | - | unknown_storage |
| 97663750 | 아이폰15프로/아이폰15PRO[미개봉/새상품/정품/애플케어/전색상] | iPhone 15 Pro | 389,000 | iphone|iphone_15_pro|unknown_storage | 0.45 | - | unknown_storage |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 333118477 | 아이폰 13 미드나이트 128GB | iPhone 13 | 410,000 | iphone|iphone_13|128gb | 0.75 | medium | 325,000 |
| 407060066 | 갤럭시 S24+ 플러스 256GB 블랙 팔아요 | Galaxy S24 Plus | 518,000 | galaxy_s|galaxy_s24_plus|256gb | 0.8 | high | 496,000 |
| 402921466 | 갤럭시S24 256기가 블랙 부산중고폰 63233 경주 울산 창원 | Galaxy S24 | 482,000 | galaxy_s|galaxy_s24|256gb | 0.8 | high | 458,000 |
| 406362413 | 아이폰15핑크 128기가 | iPhone 15 | 550,000 | iphone|iphone_15|128gb | 0.85 | medium | 550,000 |
| 407202833 | 아이폰 15 128GB 블랙 | iPhone 15 | 530,000 | iphone|iphone_15|128gb | 0.85 | medium | 550,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.

## laptop

### Top Comparable Keys
| key | count |
| --- | --- |
| macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 8 |
| macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 5 |
| macbook|macbook_pro|i7|15in|16gb_ram|512gb_ssd | 4 |
| macbook|macbook_pro|i9|16in|16gb_ram|1024gb_ssd | 4 |
| macbook|macbook_pro|i5|13in|8gb_ram|256gb_ssd | 4 |
| macbook|macbook_air|m3|15in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 3 |
| macbook|macbook_pro|m1|14in|16gb_ram|512gb_ssd | 3 |
| macbook|macbook_pro|i7|16in|16gb_ram|512gb_ssd | 3 |
| macbook|macbook_air|m5|15in|16gb_ram|512gb_ssd | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_ram | 41 |
| unknown_ssd | 31 |
| unknown_chip | 13 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407182934 | 맥북에어 2018 박스포함 | MacBook Air | 210,000 | macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 0.5900000000000001 | - | unknown_chip, unknown_ram, unknown_ssd |
| 406941155 | 맥북프로 A1707 15.6 인치 판매 합니다 - 500기가 SSD | MacBook Pro | 450,000 | macbook|macbook_pro|unknown_chip|15_6in|unknown_ram|500gb_ssd | 0.7800000000000001 | - | unknown_chip, unknown_ram |
| 406201752 | 맥북프로 고급형 I7 CPU 1테라 하드 | MacBook Pro | 300,000 | macbook|macbook_pro|i7|unknown_screen|unknown_ram|unknown_ssd | 0.63 | - | unknown_ram, unknown_ssd |
| 233107170 | 맥북프로 i5 8램 13인치 터치바 노트북(윈도우10 포토샵/일러스트 | MacBook Pro | 510,000 | macbook|macbook_pro|i5|13in|unknown_ram|256gb_ssd | 0.91 | - | unknown_ram |
| 402419165 | 맥북에어 13인치 A1466 2015 256기가 팝니다 | MacBook Air | 240,000 | macbook|macbook_air|unknown_chip|13in|unknown_ram|256gb_ssd | 0.7300000000000001 | - | unknown_chip, unknown_ram |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407051026 | 맥북에어 m1 | MacBook Air | 650,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | medium | 530,000 |
| 317588724 | 맥북에어 M1 2021 로즈골드 상태최상 하자 없음 | MacBook Air | 600,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | medium | 530,000 |
| 354789789 | 애플 맥북 에어 M2 2022 실버 256GB | MacBook Air | 940,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 825,000 |
| 407187580 | 맥북에어13 M2 노트북 | MacBook Air | 770,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 825,000 |
| 407020054 | 맥북에어 13인치 m2 8/256 | MacBook Air | 650,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 825,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.
