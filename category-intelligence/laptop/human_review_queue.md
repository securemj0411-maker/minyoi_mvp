# Laptop — Human Review Queue (v3)

- category: laptop
- generated_at: 2026-05-09T11:25:14.854Z
- 목적: AI가 만든 룰/SKU 후보 중 production 반영 전 사람이 승인할 것만 모음

## 승인 후보 Noise Rules

| approve | type | keyword | precision | hits | note |
|---|---|---|---:|---:|---|
| [ ] | buying | `매입` | 1.00 | 121 | 모든 매물이 '매입' 관련 내용으로 buying 타입이 맞으므로 정밀도는 1.0임. |
| [ ] | buying | `매입합니다` | 1.00 | 60 | 모든 매물이 '매입합니다'라는 키워드를 포함하여 모두 'buying' 타입으로 정확히 분류되었습니다. |
| [ ] | noise | `처리` | 0.00 | 71 | 모든 매물이 정상적인 매입 광고로, 'noise' 타입이 아니므로 precision은 0.0임 |
| [ ] | buying | `출장` | 1.00 | 70 | 모든 매물이 'buying' 타입에 부합하는 매입(구매) 의뢰 글로 정확히 분류됨. |
| [ ] | noise | `갤럭시북` | 0.00 | 62 | 모든 매물이 'noise' 타입이 아니므로 precision은 0.0입니다. |
| [ ] | noise | `it` | 0.60 | 103 | 전체적으로 IT 관련 매입 광고가 'noise' 타입으로 적절히 분류되었으나, 일부 판매 매물은 해당 타입이 아님. |
| [ ] | noise | `업체입니다` | 0.80 | 49 | 전체적으로 5개 중 4개가 'noise' 타입으로 정확히 분류되어 정밀도는 0.8로 평가됩니다. |
| [ ] | noise | `정책상` | 0.00 | 47 | 모든 매물이 'noise' 타입이 아니므로 precision은 0.0입니다. |
| [ ] | noise | `아이패드` | 0.80 | 51 | 전체적으로 5개 매물 중 4개가 'noise' 타입에 적합하여 정밀도는 0.8로 평가됩니다. |
| [ ] | noise | `번개장터` | 0.00 | 74 | 제공된 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다. |
| [ ] | noise | `빠르고` | 0.00 | 66 | 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다. |
| [ ] | noise | `분실` | 0.60 | 51 | 총 5개 매물 중 3개가 'noise' 타입으로 정확히 판단되어 정밀도는 0.6입니다. |
| [ ] | noise | `친절하게` | 0.00 | 42 | 제공된 모든 매물은 'noise' 타입이 아니므로 정밀도는 0.0입니다. |
| [ ] | noise | `정식` | 0.40 | 46 | 전체적으로 '정식' 키워드가 포함된 매물만 'noise' 타입으로 판단되어 정확도는 0.4임 |
| [ ] | noise | `주시면` | 0.00 | 172 | 제공된 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다. |
| [ ] | buying | `번톡` | 1.00 | 48 | 모든 매물이 'buying' 타입으로 적절하게 분류되어 있어 정밀도는 1.0임. |
| [ ] | buying | `매입업체` | 1.00 | 47 | 모든 매물이 'buying' 타입으로 적합하여 정밀도는 1.0입니다. |
| [ ] | noise | `번톡으로` | 1.00 | 42 | 모든 매물이 "번톡으로" 문의하는 내용이 포함되어 있어 모두 'noise' 타입으로 정확히 분류됨 |
| [ ] | noise | `정직한` | 0.00 | 39 | 모든 매물이 'noise' 타입이 아니므로 precision은 0.0입니다. |

## 승인 후보 SKU

| approve | sku_id | model_name | aliases | median | confidence |
|---|---|---|---|---:|---:|
| [ ] | 레노버-리전-5-15ahp10-lg-그램-17z990-va7bk-삼성-노트북-i7-15-6인치 | 레노버 리전 5 15AHP10, LG 그램 17Z990-VA7BK, 삼성 노트북 i7 15.6인치 | 레노버 리전 5 15AHP10, LG 그램 17Z990-VA7BK, 삼성 노트북 i7 15.6인치, 노트북, 중고, CPU, RAM | - | 0.90 |
| [ ] | 레노버-legion-i7-8750h-16gb-256gb-gtx1050ti | 레노버 LEGION i7 8750H 16GB 256GB GTX1050Ti | 레노버 LEGION i7 8750H 16GB 256GB GTX1050Ti, 중고노트북, 게이밍 노트북, 레노버, 사양 | - | 0.90 |
| [ ] | 맥북-프로-m4-pro-16인치-24gb-512gb-ssd | 맥북 프로 M4 Pro 16인치 24GB 512GB SSD | 맥북 프로 M4 Pro 16인치 24GB 512GB SSD, 맥북 프로, 맥북 에어, M4 Pro, 배터리 효율 100 | - | 0.90 |
| [ ] | 맥북프로-16-m4-pro-48gb-1tb | 맥북프로 16 M4 Pro 48GB 1TB | 맥북프로 16 M4 Pro 48GB 1TB, 맥북프로, M4, M3, 중고노트북 | - | 0.90 |
| [ ] | 윈도우11-노트북-인텔-cpu-8gb-ram-ssd-120-512gb | 윈도우11 노트북 인텔 CPU 8GB RAM SSD 120~512GB | 윈도우11 노트북 인텔 CPU 8GB RAM SSD 120~512GB, 윈도우11, 노트북, 중고 본체, 정품인증 | - | 0.90 |
| [ ] | apple-imac-27-inch-5k-retina-2016-2019 | Apple iMac 27-inch 5K Retina (2016-2019) | Apple iMac 27-inch 5K Retina (2016-2019), 아이맥, 27인치, 5K, 레티나 | - | 0.90 |
| [ ] | gigabyte-aorus-16x-asg-53kr-에이서-프레데터-helios-neo-v-16-phn16-72-59 | GIGABYTE AORUS 16X ASG-53KR, 에이서 프레데터 Helios Neo V 16 PHN16-72-59C2, HP 오멘 16-wf0156TX, HP 오멘 16-xf0052AX, HP 오멘 슬림 16-an0005TX | GIGABYTE AORUS 16X ASG-53KR, 에이서 프레데터 Helios Neo V 16 PHN16-72-59C2, HP 오멘 16-wf0156TX, HP 오멘 16-xf0052AX, HP 오멘 슬림 16-an0005TX, 16인치, 게이밍노트북, 직거래위치, 택배가격 | - | 0.90 |
| [ ] | macbook-pro-13인치-a1502-macbook-pro-15인치-retina-2012-macbook-pro- | MacBook Pro 13인치 A1502, MacBook Pro 15인치 Retina 2012, MacBook Pro 15인치 2017 | MacBook Pro 13인치 A1502, MacBook Pro 15인치 Retina 2012, MacBook Pro 15인치 2017, 가성비 노트북 중고, MacBook Pro, 본체, 충전기 | 899,000 | 0.90 |

## 모호 클러스터

### Cluster 13 — ambiguous / high
- reason: 이 클러스터는 아디다스 여성용 반팔 카라티 및 기능성 티셔츠에 대한 중고 의류 매물로, 노트북 카테고리와 전혀 관련이 없으며 액세서리, 부품, 파손, 매입 등 노트북 관련 분류 기준과도 맞지 않습니다. 따라서 노트북 카테고리 내에서는 명확한 분류가 불가능하여 ambiguous로 분류합니다.
  - 406611599 / 아디다스 climachill 여성 블랙 반팔 카라티 s / 10,000원
  - 406563938 / 아디다스 climachill 여성 카라티 블랙 s / 10,000원
  - 406983671 / [M] 아디다스 climacool 기능성 반팔 티셔츠 블루/네이비 / 10,000원
  - 394236230 / 아디다스 CLIMACOOL 반팔 티셔츠 105 / 17,000원

