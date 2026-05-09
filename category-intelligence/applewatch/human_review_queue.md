# 애플워치 — Human Review Queue (v3)

- category: applewatch
- generated_at: 2026-05-09T08:27:28.335Z
- 목적: AI가 만든 룰/SKU 후보 중 production 반영 전 사람이 승인할 것만 모음

## 승인 후보 Noise Rules

| approve | type | keyword | precision | hits | note |
|---|---|---|---:|---:|---|
| [ ] | parts | `부품용` | 0.80 | 93 | 총 5개 매물 중 4개가 부품용으로 적절히 분류되어 전체 정밀도는 0.8입니다. |
| [ ] | buying | `삽니다` | 1.00 | 14 | 모든 매물이 '삽니다' 키워드를 포함하여 구매 의도가 명확하므로 전체 정밀도는 1.0입니다. |
| [ ] | parts | `부품용으로` | 1.00 | 53 | 모든 매물이 부품용으로 명확히 표시되어 있어 전체적으로 부품용 타입 매물임이 확실합니다. |
| [ ] | buying | `매입` | 0.60 | 17 | 총 5개 매물 중 3개가 'buying' 타입으로 정확히 분류되어 전체 precision은 0.6입니다. |
| [ ] | noise | `50` | 0.40 | 27 | 총 5개 매물 중 2개가 'noise' 타입으로 정확히 분류되어 정밀도는 0.4입니다. |
| [ ] | buying | `매입하는` | 1.00 | 9 | 모든 매물이 '매입하는' 즉 buying 타입에 부합하여 precision은 1.0입니다. |
| [ ] | noise | `se1` | 0.80 | 20 | 총 5개 중 4개가 noise 타입으로 적합하여 전체 precision은 0.8로 양호합니다. |
| [ ] | buying | `울트라1` | 0.60 | 10 | 총 5개 중 3개가 buying 타입으로 정확히 분류되어 정밀도는 0.6입니다. |
| [ ] | noise | `받습니다` | 1.00 | 11 | 주어진 매물 중 '받습니다' 키워드가 포함된 매입 의사 표현 매물 2개 모두 정확히 'noise' 타입으로 판단되어 정밀도는 1.0입니다. |
| [ ] | noise | `언제든` | 0.20 | 12 | 전체적으로 대부분 매입 요청 글로 noise 타입이 아니며, 한 매물만 noise 타입으로 판단되어 정밀도는 0.2입니다. |
| [ ] | noise | `맨처음` | 1.00 | 8 | 모든 매물이 '맨처음' 키워드를 포함하고 있어 모두 'noise' 타입으로 정확히 분류됨. |
| [ ] | noise | `양식부터` | 1.00 | 8 | 모든 매물이 '양식부터' 키워드를 포함한 'noise' 타입으로 정확히 분류되었습니다. |
| [ ] | noise | `안적으시면` | 1.00 | 8 | 모든 매물이 "안적으시면" 키워드를 포함하여 noise 타입으로 정확히 분류됨. |
| [ ] | noise | `답장안합니다` | 1.00 | 8 | 모든 매물이 "답장안합니다" 문구를 포함하여 noise 타입으로 정확히 분류되었습니다. |

## 승인 후보 SKU

| approve | sku_id | model_name | aliases | median | confidence |
|---|---|---|---|---:|---:|
| [ ] | 애플워치-시리즈-9-gps-45mm | 애플워치 시리즈 9 GPS 45mm | 애플워치 시리즈 9 GPS 45mm, 애플워치, 시리즈9, 시리즈10, GPS | - | 0.90 |
| [ ] | 애플워치-se-44mm-애플워치-시리즈-11-46mm | 애플워치 SE 44mm, 애플워치 시리즈 11 46mm | 애플워치 SE 44mm, 애플워치 시리즈 11 46mm, 애플워치, SE, 시리즈3, 시리즈11 | - | 0.90 |
| [ ] | apple-watch-se-3-40mm-gps | Apple Watch SE 3 40mm GPS | Apple Watch SE 3 40mm GPS, 애플워치 SE, SE3, 40mm, 배터리 성능 | - | 0.90 |
| [ ] | apple-watch-se-40mm-apple-watch-se3-40mm-apple-watch-series-7-45 | Apple Watch SE 40mm, Apple Watch SE3 40mm, Apple Watch Series 7 45mm | Apple Watch SE 40mm, Apple Watch SE3 40mm, Apple Watch Series 7 45mm, 애플워치, SE, SE3, Series 7 | - | 0.90 |
| [ ] | apple-watch-se3-44mm-se3-40mm-se2-40mm-se1 | Apple Watch SE3 44mm / SE3 40mm / SE2 40mm / SE1 | Apple Watch SE3 44mm / SE3 40mm / SE2 40mm / SE1, 애플워치, SE3, SE2, 미개봉 | - | 0.90 |
| [ ] | apple-watch-series-10-gps-46mm | Apple Watch Series 10 GPS 46mm | Apple Watch Series 10 GPS 46mm, 애플워치, Series 10, Series 7, SE | - | 0.90 |
| [ ] | apple-watch-series-3 | Apple Watch Series 3 | Apple Watch Series 3, 애플워치, 시리즈 3, 판매, 배터리 | - | 0.90 |
| [ ] | apple-watch-series-3-38mm-42mm | Apple Watch Series 3 38mm / 42mm | Apple Watch Series 3 38mm / 42mm, 애플워치, 시리즈3, 38mm, 42mm | - | 0.90 |
| [ ] | apple-watch-series-5-44mm-series-6-40mm-series-11-46mm-se1-44mm | Apple Watch Series 5 44mm, Series 6 40mm, Series 11 46mm, SE1 44mm | Apple Watch Series 5 44mm, Series 6 40mm, Series 11 46mm, SE1 44mm, 애플워치, 시리즈, 풀박스, 배터리 성능 | - | 0.90 |
| [ ] | apple-watch-series-6 | Apple Watch Series 6 | Apple Watch Series 6, 애플워치, 시리즈6, Series 6, 본체 | - | 0.90 |
| [ ] | apple-watch-series-7-45mm | Apple Watch Series 7 45mm | Apple Watch Series 7 45mm, 애플워치, 시리즈7, 45mm, 배터리 효율 | - | 0.90 |
