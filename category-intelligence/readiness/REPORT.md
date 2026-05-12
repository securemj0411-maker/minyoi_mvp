# Category Readiness Report

- generated_at: 2026-05-11T08:11:54.914Z
- source rows limit: 3000

| category | gate | rows | parse ready | critical unknown | market trusted keys | recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| earphone | ready | 169 | 134/169 (79.3%) | 32 (18.9%) | 8 (high 7, medium 1) | ready_candidate: 운영자 검수 후 ready 승격 가능 |
| smartwatch | ready | 25 | 24/25 (96%) | 1 (4%) | 14 (high 9, medium 5) | keep_internal: 표본 100건 미만 |
| smartphone | internal_only | 123 | 104/123 (84.6%) | 19 (15.4%) | 20 (high 4, medium 16) | keep_internal: 고위험 샘플 검수 필요 |
| tablet | internal_only | 659 | 545/659 (82.7%) | 118 (17.9%) | 37 (high 12, medium 25) | keep_internal: 고위험 샘플 검수 필요 |
| laptop | internal_only | 24 | 11/24 (45.8%) | 21 (87.5%) | 1 (high 0, medium 1) | keep_internal: 표본 100건 미만 |

## earphone

### Top Comparable Keys
| key | count |
| --- | --- |
| airpods|airpods_pro_2_lightning|lightning | 52 |
| airpods|airpods_max|lightning | 21 |
| airpods|airpods_4|usbc|unknown_anc | 17 |
| airpods|airpods_max|unknown_connector | 15 |
| airpods|airpods_max|usbc | 13 |
| airpods|airpods_4|usbc|anc | 13 |
| airpods|airpods_pro_1|lightning | 11 |
| airpods|airpods_pro_2_usbc|usbc | 10 |
| airpods|airpods_3|lightning | 8 |
| airpods|airpods_4|usbc|no_anc | 6 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_anc | 17 |
| unknown_connector | 15 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 365731449 | 에어팟 맥스 스마트 케이스 | AirPods Max | 50,000 | airpods|airpods_max|unknown_connector | 0.4700000000000001 | - | unknown_connector |
| 329672722 | (새상품)라세레모니 에어팟맥스 커버 | AirPods Max | 52,000 | airpods|airpods_max|unknown_connector | 0.4700000000000001 | - | unknown_connector |
| 404699640 | 케이스티파이 에어팟4세대 케이스 | AirPods 4th gen | 40,000 | airpods|airpods_4|usbc|unknown_anc | 0.62 | - | unknown_anc |
| 400883050 | 애플 에어팟 맥스 퍼플 + 그린 커스텀 케이스 | AirPods Max | 400,000 | airpods|airpods_max|usbc | 0.6 | high | - |
| 359983089 | 온차 에어팟맥스 뜨개 케이스 | AirPods Max | 25,000 | airpods|airpods_max|unknown_connector | 0.4700000000000001 | - | unknown_connector |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407378262 | 에어팟프로 2세대 C타입 OR 8핀 A급 세트 | AirPods Pro 2nd gen (USB-C) | 210,000 | airpods|airpods_pro_2_usbc|usbc | 0.7 | high | 170,000 |
| 407330275 | [가성비] 에어팟 프로2세대 풀박스 급처합니다!+사은품 증정 | AirPods Pro 2nd gen (Lightning) | 160,000 | airpods|airpods_pro_2_lightning|lightning | 0.7 | high | 150,000 |
| 403227938 | 에어팟맥스 실버 A2096 (풀박스, 거치대, 커버, 케이스 포함) | AirPods Max | 500,000 | airpods|airpods_max|lightning | 0.75 | high | 300,000 |
| 406744163 | 애플 에어팟 맥스 스페이스 그레이 + 케이스 | AirPods Max | 450,000 | airpods|airpods_max|lightning | 0.75 | high | 300,000 |
| 407330835 | [가성비] 에어팟 프로2세대 풀박스 급처합니다!+사은품 증정 | AirPods Pro 2nd gen (Lightning) | 150,000 | airpods|airpods_pro_2_lightning|lightning | 0.7 | high | 150,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.

## smartwatch

### Top Comparable Keys
| key | count |
| --- | --- |
| applewatch|applewatch_se2|44mm|unknown_connectivity | 4 |
| applewatch|applewatch_series8|45mm|unknown_connectivity | 2 |
| galaxywatch|galaxywatch_7|44mm|unknown_connectivity | 2 |
| applewatch|applewatch_se2|40mm|unknown_connectivity | 2 |
| applewatch|applewatch_series10|42mm|gps | 2 |
| applewatch|applewatch_se3|40mm|unknown_connectivity | 1 |
| applewatch|applewatch_se2|40mm|gps | 1 |
| applewatch|applewatch_se3|44mm|unknown_connectivity | 1 |
| applewatch|applewatch_ultra|49mm|cellular | 1 |
| applewatch|applewatch_series8|41mm|unknown_connectivity | 1 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_size | 1 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407272731 | 애플워치 se 2세대 실버 | Apple Watch SE 2nd gen | 100,000 | applewatch|applewatch_se2|unknown_size|unknown_connectivity | 0.5 | - | unknown_size |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407352461 | 애플워치 se3 40mm 스타라이트 미개봉 | Apple Watch SE 3rd gen | 300,000 | applewatch|applewatch_se3|40mm|unknown_connectivity | 0.75 | medium | 290,000 |
| 407412632 | 애플워치SE 2세대 40mm GPS 판매합니다! | Apple Watch SE 2nd gen | 100,000 | applewatch|applewatch_se2|40mm|gps | 0.82 | high | 170,000 |
| 407407267 | 애플워치 미드나이트 se3 44mm | Apple Watch SE 3rd gen | 246,000 | applewatch|applewatch_se3|44mm|unknown_connectivity | 0.75 | high | 285,000 |
| 407403344 | 애플워치 울트라 3 49mm 셀룰러 제품 풀박스 | Apple Watch Ultra | 900,000 | applewatch|applewatch_ultra|49mm|cellular | 0.87 | high | 497,500 |
| 407294982 | 갤럭시워치7 44mm | Galaxy Watch 7 | 180,000 | galaxywatch|galaxywatch_7|44mm|unknown_connectivity | 0.75 | high | 180,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.

## smartphone

### Top Comparable Keys
| key | count |
| --- | --- |
| iphone|iphone_15_pro_max|256gb | 15 |
| iphone|iphone_16_pro_max|256gb | 13 |
| galaxy_s|galaxy_s25|256gb | 11 |
| iphone|iphone_14|128gb | 7 |
| galaxy_s|galaxy_s24|256gb | 5 |
| galaxy_s|galaxy_s23|256gb | 5 |
| iphone|iphone_15_pro_max|unknown_storage | 5 |
| galaxy_s|galaxy_s23_ultra|unknown_storage | 4 |
| iphone|iphone_15|256gb | 4 |
| iphone|iphone_16e|128gb | 4 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_storage | 19 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 393952344 | 구매 갤럭시 s23 울트라 구매 합니다. | Galaxy S23 Ultra | 500,000 | galaxy_s|galaxy_s23_ultra|unknown_storage | 0.5 | - | unknown_storage |
| 407292373 | 와일드플라워 아이폰 15 프로맥스 | iPhone 15 Pro Max | 30,000 | iphone|iphone_15_pro_max|unknown_storage | 0.45 | - | unknown_storage |
| 335972462 | 갤럭시s23울트라 플레이트 팝니다 | Galaxy S23 Ultra | 10,000 | galaxy_s|galaxy_s23_ultra|unknown_storage | 0.45 | - | unknown_storage |
| 407301714 | 삼성 갤럭시 S23 울트라, S24 울트라 스타일러스 펜, S펜 | Galaxy S23 Ultra | 45,000 | galaxy_s|galaxy_s23_ultra|unknown_storage | 0.45 | - | unknown_storage |
| 407299017 | 아이폰 16 프로 맥스 | iPhone 16 Pro | 1,400,000 | iphone|iphone_16_pro|unknown_storage | 0.45 | - | unknown_storage |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407331164 | [리퍼급]갤럭시S24 최상급컨디션 256G 화이트 공기계 중고폰 | Galaxy S24 | 549,000 | galaxy_s|galaxy_s24|256gb | 0.75 | medium | 470,000 |
| 407334977 | [리퍼급]갤럭시S23 최상급컨디션 256G 라벤더 공기계 중고폰 | Galaxy S23 | 439,000 | galaxy_s|galaxy_s23|256gb | 0.75 | medium | 380,000 |
| 407339646 | 아이폰16프로맥스 256 | iPhone 16 Pro Max | 1,100,000 | iphone|iphone_16_pro_max|256gb | 0.75 | high | 1,350,000 |
| 402111990 | 갤럭시s25엣지 티타늄실버 256기가 A급 | Galaxy S25 | 760,000 | galaxy_s|galaxy_s25|256gb | 0.75 | medium | 721,250 |
| 407344018 | 갤럭시 S23 Ultra 512GB 그린 팝니다 | Galaxy S23 Ultra | 500,000 | galaxy_s|galaxy_s23_ultra|512gb | 0.8 | high | 650,000 |

### High Risk Parser Examples
| pid | issue | name | key |
| --- | --- | --- | --- |
| 407331164 | condition:cosmetic_wear,repair_or_defect_signal,refurbished_or_repaired | [리퍼급]갤럭시S24 최상급컨디션 256G 화이트 공기계 중고폰 | galaxy_s|galaxy_s24|256gb |
| 407334977 | condition:cosmetic_wear,repair_or_defect_signal,refurbished_or_repaired | [리퍼급]갤럭시S23 최상급컨디션 256G 라벤더 공기계 중고폰 | galaxy_s|galaxy_s23|256gb |
| 406154844 | condition:cosmetic_wear,repair_or_defect_signal | 아이폰 14 프로맥스 256 스페이스 블랙 팝니다 | iphone|iphone_14_pro_max|256gb |
| 407339646 | condition:good_condition,repair_or_defect_signal | 아이폰16프로맥스 256 | iphone|iphone_16_pro_max|256gb |
| 402111990 | condition:good_condition,locked_or_lost_signal,carrier_status_disclosed | 갤럭시s25엣지 티타늄실버 256기가 A급 | galaxy_s|galaxy_s25|256gb |

## tablet

### Top Comparable Keys
| key | count |
| --- | --- |
| ipad|ipad_10|10_9in|64gb|wifi | 63 |
| ipad|ipad_air|10_9in|64gb|wifi | 43 |
| ipad|ipad_air|11in|128gb|wifi | 33 |
| ipad|ipad_mini|8_3in|128gb|wifi | 26 |
| ipad|ipad_pro|11in|256gb|wifi | 24 |
| galaxy_tab|galaxy_tab_s10_ultra|14_6in|256gb|wifi | 23 |
| galaxy_tab|galaxy_tab_s9_fe_plus|12_4in|128gb|wifi | 19 |
| ipad|ipad_10|10_9in|unknown_storage|wifi | 19 |
| ipad|ipad_mini|8_3in|64gb|wifi | 18 |
| galaxy_tab|galaxy_tab_s8|11in|128gb|wifi | 14 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_storage | 108 |
| unknown_screen | 10 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 361551659 | 삼성 갤럭시 탭 S9 FE+ 미개봉 10대 | Galaxy Tab S9 FE Plus | 4,700,000 | galaxy_tab|galaxy_tab_s9_fe_plus|12_4in|unknown_storage|wifi | 0.6900000000000001 | - | unknown_storage |
| 368386557 | 삼성 갤럭시탭 S9 FE+ 풀박스 미개봉 | Galaxy Tab S9 FE Plus | 450,000 | galaxy_tab|galaxy_tab_s9_fe_plus|12_4in|unknown_storage|wifi | 0.6900000000000001 | - | unknown_storage |
| 402269191 | 아이패드 미니 A17pro 팝니다 | iPad mini | 600,000 | ipad|ipad_mini|8_3in|unknown_storage|wifi | 0.6900000000000001 | - | unknown_storage |
| 402263939 | 아이패드 미니 A17pro 스그 + 애플케어 | iPad mini | 750,000 | ipad|ipad_mini|8_3in|unknown_storage|wifi | 0.6900000000000001 | - | unknown_storage |
| 335646552 | 갤럭시 탭s9FE+ 테블릿 | Galaxy Tab S9 FE Plus | 500,000 | galaxy_tab|galaxy_tab_s9_fe_plus|12_4in|unknown_storage|wifi | 0.6900000000000001 | - | unknown_storage |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 405486000 | 아이패드 미니 (A17 Pro) 128GB 미개봉 | iPad mini | 600,000 | ipad|ipad_mini|8_3in|128gb|wifi | 0.92 | high | 600,000 |
| 406406219 | Apple 아이패드 미니 A17 Pro 128GB Wi-Fi 미개봉 새품 | iPad mini | 650,000 | ipad|ipad_mini|8_3in|128gb|wifi | 0.92 | high | 600,000 |
| 401538260 | 부산 아이패드미니 7세대 128기가 wifi(a17 pro) | iPad mini | 570,000 | ipad|ipad_mini|8_3in|128gb|wifi | 0.9700000000000001 | high | 600,000 |
| 405827255 | 아이패드 미니7세대 A17pro 128GB(애캐플) | iPad mini | 750,000 | ipad|ipad_mini|8_3in|128gb|wifi | 0.9700000000000001 | high | 600,000 |
| 373476232 | 미개봉)아이패드 미니 A17 pro 128기가 wifi 팝니다 | iPad mini | 700,000 | ipad|ipad_mini|8_3in|128gb|wifi | 0.92 | high | 600,000 |

### High Risk Parser Examples
| pid | issue | name | key |
| --- | --- | --- | --- |
| 340399223 | condition:repair_or_defect_signal | 삼성 갤럭시탭 s8+ (오늘거래시 45 무료배송) | galaxy_tab|galaxy_tab_s8_plus|12_4in|unknown_storage|wifi |
| 407291993 | condition:cosmetic_wear,low_battery_health | 아이패드 미니5 WiFi 64GB 판매 | ipad|ipad_mini|7_9in|64gb|wifi |
| 405126145 | condition:new_or_open_box,display_defect | 아이패드 프로 11인치 2세대 128GB | ipad|ipad_pro|11in|128gb|wifi |
| 392012857 | condition:refurbished_or_repaired | 아이패드 프로 13 M4 256G WIFI 팝니다(26.05.09 재등록 | ipad|ipad_pro|13in|256gb|wifi |
| 405859667 | condition:good_condition,cosmetic_wear,repair_or_defect_signal,refurbished_or_repaired | 아이패드 에어5 256g 스페이스그레이 (sss급) | ipad|ipad_air|10_9in|256gb|wifi |

## laptop

### Top Comparable Keys
| key | count |
| --- | --- |
| macbook|macbook_pro|2021y|m1_max|16in|32gb_ram|1024gb_ssd | 4 |
| macbook|macbook_pro|unknown_generation|m5|14in|36gb_ram|1024gb_ssd | 1 |
| macbook|macbook_air|2023y|m2|13in|8gb_ram|256gb_ssd | 1 |
| macbook|macbook_pro|2025y|m4|16in|24gb_ram|1024gb_ssd | 1 |
| macbook|macbook_air|unknown_generation|m1|13in|16gb_ram|256gb_ssd | 1 |
| macbook|macbook_pro|2019y|i5|13in|8gb_ram|unknown_ssd | 1 |
| macbook|macbook_pro|2023y|m2_pro|14in|16gb_ram|1024gb_ssd | 1 |
| macbook|macbook_pro|2026y|m3_max|14in|96gb_ram|1024gb_ssd | 1 |
| macbook|macbook_pro|2021y|m1_pro|16in|16gb_ram|1024gb_ssd | 1 |
| macbook|macbook_air|unknown_generation|m2|13in|16gb_ram|256gb_ssd | 1 |

### Critical Unknowns
| unknown | count |
| --- | --- |
| unknown_generation | 10 |
| unknown_ram | 5 |
| unknown_ssd | 4 |
| unknown_chip | 2 |

### Needs Review Examples
| pid | name | sku | price | key | conf | market | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407334874 | 맥북프로 14 M5칩 36GB 1TB +애플케(29/02) / 교육용번들 | MacBook Pro | 3,700,000 | macbook|macbook_pro|unknown_generation|m5|14in|36gb_ram|1024gb_ssd | 1 | - | unknown_generation |
| 407344622 | 맥북에어 m1 16g 256g 풀박 | MacBook Air | 600,000 | macbook|macbook_air|unknown_generation|m1|13in|16gb_ram|256gb_ssd | 1 | - | unknown_generation |
| 407348819 | 2019 맥북 프로 13인치 i5 8G | MacBook Pro | 320,000 | macbook|macbook_pro|2019y|i5|13in|8gb_ram|unknown_ssd | 1 | - | unknown_ssd |
| 407297612 | 맥북 에어m2 13인치 | MacBook Air | 830,000 | macbook|macbook_air|unknown_generation|m2|13in|16gb_ram|256gb_ssd | 1 | - | unknown_generation |
| 407299850 | 맥북프로 A1502 포토샺 및 파이널컷 로직사용 가능 | MacBook Pro | 200,000 | macbook|macbook_pro|a1502|intel|13in|unknown_ram|unknown_ssd | 0.89 | - | unknown_ram, unknown_ssd |

### Trusted Examples
| pid | name | sku | price | key | conf | market | median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 407311582 | 맥북프로 16인치 2019 i9 16GB 1TB | MacBook Pro | 600,000 | macbook|macbook_pro|2019y|i9|16in|16gb_ram|1024gb_ssd | 1 | medium | 695,000 |

### High Risk Parser Examples
No high-risk parser examples found in this sample.
