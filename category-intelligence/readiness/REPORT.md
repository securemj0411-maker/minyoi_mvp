# Category Readiness Report

- generated_at: 2026-05-10T09:02:52.430Z
- source rows limit: 3000

| category | gate | rows | parse ready | critical unknown | market trusted keys | recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| smartphone | internal_only | 57 | 51/57 (89.5%) | 6 (10.5%) | 9 (high 3, medium 6) | keep_internal: 표본 100건 미만 |
| laptop | internal_only | 185 | 79/185 (42.7%) | 182 (98.4%) | 2 (high 0, medium 2) | keep_internal: 옵션 파서 통과율 75% 미만 |

## smartphone

### Top Comparable Keys
| key | count |
| --- | --- |
| iphone|iphone_15|128gb | 7 |
| iphone|iphone_16|128gb | 6 |
| galaxy_s|galaxy_s23|256gb | 5 |
| iphone|iphone_15_pro|256gb | 4 |
| iphone|iphone_15|unknown_storage | 4 |
| galaxy_s|galaxy_s24|512gb | 4 |
| galaxy_s|galaxy_s23|512gb | 3 |
| galaxy_s|galaxy_s24|256gb | 3 |
| iphone|iphone_13|128gb | 3 |
| iphone|iphone_14|128gb | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_storage | 6 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 97663750 | 아이폰15프로/아이폰15PRO[미개봉/새상품/정품/애플케어/전색상] | iPhone 15 Pro | 389,000 | iphone|iphone_15_pro|unknown_storage | 0.45 | - | unknown_storage |
| 274081619 | [풀박스/전색상]아이폰15 핑크색상 재입고 품절임박 번개톡 문의주세요 | iPhone 15 | 198,000 | iphone|iphone_15|unknown_storage | 0.45 | - | unknown_storage |
| 406098378 | 아이폰 에어 블랙 -> 아이폰15블루 , 아이폰15블랙 교환하실분 | iPhone 15 | 500,000 | iphone|iphone_15|unknown_storage | 0.45 | - | unknown_storage |
| 406099044 | 아이폰 15프로 256기가 화이트티타늄 | iPhone 15 Pro | 750,000 | iphone|iphone_15_pro|unknown_storage | 0.45 | - | unknown_storage |
| 395755419 | 어반소피스티케이션 아이폰 15 | iPhone 15 | 22,000 | iphone|iphone_15|unknown_storage | 0.45 | - | unknown_storage |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 287928673 | 아이폰15/128GB[APPLE] | iPhone 15 | 198,800 | iphone|iphone_15|128gb | 0.75 | medium | 550,000 |
| 404765783 | 갤럭시S23 512기가 그린 (S급) / 0428 | Galaxy S23 | 410,000 | galaxy_s|galaxy_s23|512gb | 0.75 | medium | 360,000 |
| 407060066 | 갤럭시 S24+ 플러스 256GB 블랙 팔아요 | Galaxy S24 Plus | 518,000 | galaxy_s|galaxy_s24_plus|256gb | 0.8 | high | 496,000 |
| 287927513 | 아이폰15/128GB[APPLE] | iPhone 15 | 343,000 | iphone|iphone_15|128gb | 0.75 | medium | 550,000 |
| 402921466 | 갤럭시S24 256기가 블랙 부산중고폰 63233 경주 울산 창원 | Galaxy S24 | 482,000 | galaxy_s|galaxy_s24|256gb | 0.8 | high | 458,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.

## laptop

### Top Comparable Keys
| key | count |
| --- | --- |
| macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 9 |
| macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 5 |
| macbook|macbook_air|m1|13in|unknown_ram|unknown_ssd | 5 |
| macbook|macbook_pro|unknown_chip|unknown_screen|unknown_ram|unknown_ssd | 5 |
| macbook|macbook_air|m1|13in|unknown_ram|256gb_ssd | 4 |
| macbook|macbook_air|m5|13in|unknown_ram|512gb_ssd | 4 |
| macbook|macbook_air|m5|13in|16gb_ram|512gb_ssd | 4 |
| macbook|macbook_air|m2|13in|unknown_ram|256gb_ssd | 3 |
| macbook|macbook_pro|i5|unknown_screen|8gb_ram|128gb_ssd | 3 |
| macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_ram | 91 |
| unknown_ssd | 65 |
| unknown_chip | 26 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407160553 | 맥북프로 M3 16인치 실버 | MacBook Pro | 2,450,000 | macbook|macbook_pro|m3|16in|unknown_ram|unknown_ssd | 0.77 | - | unknown_ram, unknown_ssd |
| 406454200 | 맥북에어 M2 13인치 16/256 미드나이트 + 멀티허브 | MacBook Air | 850,000 | macbook|macbook_air|m2|13in|unknown_ram|256gb_ssd | 0.9600000000000001 | - | unknown_ram |
| 407131767 | (배터리93) 맥북 에어 m1 13인치 8 512 | MacBook Air | 620,000 | macbook|macbook_air|m1|13in|unknown_ram|512gb_ssd | 0.91 | - | unknown_ram |
| 406941155 | 맥북프로 A1707 15.6 인치 판매 합니다 - 500기가 SSD | MacBook Pro | 450,000 | macbook|macbook_pro|unknown_chip|15in|unknown_ram|500gb_ssd | 0.7800000000000001 | - | unknown_chip, unknown_ram |
| 394520664 | 맥북 박스ㅡ맥북에어13맥북에어13. m1 .8gb 256사진과 | MacBook Air | 19,000 | macbook|macbook_air|m1|13in|unknown_ram|256gb_ssd | 0.91 | - | unknown_ram |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407187580 | 맥북에어13 M2 노트북 | MacBook Air | 770,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 825,000 |
| 407218307 | 맥북 에어 M1 2020 8GB 실버 | MacBook Air | 550,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | medium | 530,000 |
| 407020054 | 맥북에어 13인치 m2 8/256 | MacBook Air | 650,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 825,000 |
| 405986821 | 맥북 에어 M1 13인치 스페이스그레이 (8G/256G) | MacBook Air | 530,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | medium | 530,000 |
| 406623427 | 맥북 에어 13 m2칩 실버 8GB 256GB SSD 팔아요 | MacBook Air | 1,000,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 825,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.
