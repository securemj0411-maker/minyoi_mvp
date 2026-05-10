# Category Readiness Report

- generated_at: 2026-05-10T09:17:10.114Z
- source rows limit: 6000

| category | gate | rows | parse ready | critical unknown | market trusted keys | recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| smartphone | internal_only | 75 | 70/75 (93.3%) | 5 (6.7%) | 9 (high 3, medium 6) | keep_internal: 표본 100건 미만 |
| laptop | internal_only | 196 | 136/196 (69.4%) | 102 (52%) | 2 (high 0, medium 2) | keep_internal: 옵션 파서 통과율 75% 미만 |

## smartphone

### Top Comparable Keys
| key | count |
| --- | --- |
| iphone|iphone_15|128gb | 9 |
| galaxy_s|galaxy_s24_plus|256gb | 9 |
| iphone|iphone_15|256gb | 6 |
| iphone|iphone_13|128gb | 6 |
| iphone|iphone_16|128gb | 6 |
| galaxy_s|galaxy_s24|256gb | 5 |
| galaxy_s|galaxy_s23|256gb | 5 |
| galaxy_s|galaxy_s24_plus|512gb | 5 |
| iphone|iphone_15_pro|256gb | 4 |
| iphone|iphone_16|256gb | 4 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_storage | 5 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 97663750 | 아이폰15프로/아이폰15PRO[미개봉/새상품/정품/애플케어/전색상] | iPhone 15 Pro | 389,000 | iphone|iphone_15_pro|unknown_storage | 0.45 | - | unknown_storage |
| 274081619 | [풀박스/전색상]아이폰15 핑크색상 재입고 품절임박 번개톡 문의주세요 | iPhone 15 | 198,000 | iphone|iphone_15|unknown_storage | 0.45 | - | unknown_storage |
| 406154780 | 아이폰 15프로 1테라 자급제 판매합니다~! | iPhone 15 Pro | 970,000 | iphone|iphone_15_pro|unknown_storage | 0.5 | - | unknown_storage |
| 381326248 | 아이폰16e(화이트) 배터리 성능 95 | iPhone 16 | 550,000 | iphone|iphone_16|unknown_storage | 0.55 | - | unknown_storage |
| 271457547 | 갤럭시 s23 미사용 신품 미개봉 슈퍼말차 에디션 | Galaxy S23 | 940,000 | galaxy_s|galaxy_s23|unknown_storage | 0.45 | - | unknown_storage |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 287927513 | 아이폰15/128GB[APPLE] | iPhone 15 | 343,000 | iphone|iphone_15|128gb | 0.75 | medium | 550,000 |
| 407224055 | (5616)아이폰15 256 깨끗한기기 판매 | iPhone 15 | 630,000 | iphone|iphone_15|256gb | 0.8 | medium | 615,000 |
| 333118477 | 아이폰 13 미드나이트 128GB | iPhone 13 | 410,000 | iphone|iphone_13|128gb | 0.75 | medium | 325,000 |
| 402921466 | 갤럭시S24 256기가 블랙 부산중고폰 63233 경주 울산 창원 | Galaxy S24 | 482,000 | galaxy_s|galaxy_s24|256gb | 0.8 | high | 458,000 |
| 407158607 | 갤럭시S23 512G 무잔상 중고폰 공기계 | Galaxy S23 | 340,000 | galaxy_s|galaxy_s23|512gb | 0.75 | medium | 360,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.

## laptop

### Top Comparable Keys
| key | count |
| --- | --- |
| macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 12 |
| macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 6 |
| macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 5 |
| macbook|macbook_pro|i7|15in|16gb_ram|512gb_ssd | 4 |
| macbook|macbook_pro|i9|16in|16gb_ram|1024gb_ssd | 4 |
| macbook|macbook_pro|i5|13in|8gb_ram|256gb_ssd | 4 |
| macbook|macbook_air|m3|15in|8gb_ram|256gb_ssd | 3 |
| macbook|macbook_air|m4|15in|16gb_ram|256gb_ssd | 3 |
| macbook|macbook_pro|m1|14in|16gb_ram|512gb_ssd | 3 |
| macbook|macbook_air|m2|13in|unknown_ram|unknown_ssd | 3 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_ram | 47 |
| unknown_ssd | 38 |
| unknown_chip | 17 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 406642377 | 드디어 팝니다!!!@@@ 집에서만 사용한!! 애플 맥북 에어 2015 | MacBook Air | 170,000 | macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 0.5900000000000001 | - | unknown_chip, unknown_ram, unknown_ssd |
| 395933974 | 맥북 박스ㅡ맥북에어m4박스사진과 동일중고로 파시는분들 박스 있으시 | MacBook Air | 30,000 | macbook|macbook_air|m4|13in|unknown_ram|unknown_ssd | 0.77 | - | unknown_ram, unknown_ssd |
| 395933492 | 맥북 박스ㅡ맥북에어사진과 동일중고로 파시는분들 박스 있으시면 더 | MacBook Air | 20,000 | macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 0.5900000000000001 | - | unknown_chip, unknown_ram, unknown_ssd |
| 388500431 | 맥북 에어(MacBook Air) 전용 SSD 저장장치입니다 | MacBook Air | 120,000 | macbook|macbook_air|unknown_chip|13in|unknown_ram|unknown_ssd | 0.5900000000000001 | - | unknown_chip, unknown_ram, unknown_ssd |
| 405255061 | 맥북프로13인치 m1 256gb | MacBook Pro | 660,000 | macbook|macbook_pro|m1|13in|unknown_ram|256gb_ssd | 0.91 | - | unknown_ram |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407218307 | 맥북 에어 M1 2020 8GB 실버 | MacBook Air | 550,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | medium | 530,000 |
| 407187580 | 맥북에어13 M2 노트북 | MacBook Air | 770,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 825,000 |
| 354789789 | 애플 맥북 에어 M2 2022 실버 256GB | MacBook Air | 940,000 | macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd | 1 | medium | 825,000 |
| 317588724 | 맥북에어 M1 2021 로즈골드 상태최상 하자 없음 | MacBook Air | 600,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | medium | 530,000 |
| 406800348 | (배터리94) 맥북 에어 m1 13인치 8 256 | MacBook Air | 600,000 | macbook|macbook_air|m1|13in|8gb_ram|256gb_ssd | 1 | medium | 530,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.
