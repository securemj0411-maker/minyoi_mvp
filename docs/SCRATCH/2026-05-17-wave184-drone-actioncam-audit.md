# Wave 184 — DJI 드론 + 액션캠 + GoPro audit (새 카테고리 "drone")

## 새 카테고리 결정
- 카테고리: **"drone"** (DJI 드론 + 액션캠 + GoPro 모두 포함)
- 이유: camera (DSLR/미러리스) 와 시세 분리 + UI 분류 명확
- readiness: **internal_only** 시작 (narrow lane 으로 ready 풀 진입)

## 라인업 (9년 정책 이내, 2017+)

### DJI 드론
| SKU id | 모델 | 출시 | base | 비고 |
|---|---|---|---|---|
| dji-mini-2 | DJI Mini 2 | 2020.11 | 본체 | Fly More Combo 별도 |
| dji-mini-3-pro | DJI Mini 3 Pro | 2022.5 | 본체 | RC vs 단품 변형 |
| dji-mini-4-pro | DJI Mini 4 Pro | 2024.9 | 본체 | RC 2 신모델 |
| dji-mavic-3 | DJI Mavic 3 | 2021.11 | 본체 | |
| dji-mavic-3-pro | DJI Mavic 3 Pro | 2023.4 | 본체 | |
| dji-mavic-3-classic | DJI Mavic 3 Classic | 2022.11 | 본체 | |
| dji-air-2s | DJI Air 2S | 2021.4 | 본체 | |
| dji-air-3 | DJI Air 3 | 2023.7 | 본체 | |
| dji-air-3s | DJI Air 3S | 2024.10 | 본체 | |
| dji-avata | DJI Avata | 2022.8 | 본체 | FPV |
| dji-avata-2 | DJI Avata 2 | 2024.4 | 본체 | |

### DJI 액션캠 / 포켓
| SKU id | 모델 | 출시 | base |
|---|---|---|---|
| dji-osmo-action-3 | DJI Osmo Action 3 | 2022.9 | 단일 |
| dji-osmo-action-4 | DJI Osmo Action 4 | 2023.9 | 단일 |
| dji-osmo-action-5-pro | DJI Osmo Action 5 Pro | 2024.9 | 단일 |
| dji-osmo-pocket-2 | DJI Osmo Pocket 2 | 2020.10 | 단일 |
| dji-osmo-pocket-3 | DJI Osmo Pocket 3 | 2023.10 | 단일 |

### GoPro
| SKU id | 모델 | 출시 | base |
|---|---|---|---|
| gopro-hero-9 | GoPro Hero 9 Black | 2020.9 | 단일 |
| gopro-hero-10 | GoPro Hero 10 Black | 2021.9 | 단일 |
| gopro-hero-11 | GoPro Hero 11 Black | 2022.9 | 단일 |
| gopro-hero-12 | GoPro Hero 12 Black | 2023.9 | 단일 |
| gopro-hero-13 | GoPro Hero 13 Black | 2024.9 | 단일 |
| gopro-max | GoPro Max (360) | 2019.10 | 단일 |

**총 22 SKU 라인업.**

## 옵션
- **DJI 드론**: 본체 only vs Fly More Combo (+20~40만, 배터리 3개 + RC + 케이스). 
  - 결정: **catalog narrow lane = 본체 only** (mustNotContain "콤보"/"combo"/"fly more"). Combo 매물은 별도 SKU 또는 풀 진입 X (recall loss but precision 유지).
- **DJI 액션캠/포켓**: 단일 옵션 (액세서리 별매).
- **GoPro**: 단일 (메모리 별매).

## 짝퉁 risk
- **DJI**: 짝퉁 거의 없음 (정품 등록 + DJI 활성화 필수)
- **GoPro**: 짝퉁 거의 없음

## 운영 risk (mustNotContain)
- 부품 단품: "배터리만", "프롭만", "프로펠러만", "충전기만", "케이스만", "어댑터만"
- 컴보/패키지: 본체 SKU 의 경우 "fly more", "콤보", "combo" 박기
- 다른 변형: 다른 세대/모델 격리 (mustNotContain)
- "수리", "고장", "파손", "추락"

## mining query
DJI 드론: "DJI Mini 2/3/4 Pro", "DJI Mavic 3/Pro/Classic", "DJI Air 2S/3/3S", "DJI Avata 2"
DJI 액션캠: "DJI Osmo Action 3/4/5 Pro", "Osmo Pocket 2/3"
GoPro: "GoPro Hero 9/10/11/12/13", "GoPro Max"

## 작업
1. Sku type category enum 에 "drone" 추가
2. catalog 22 SKU 추가
3. category-readiness.ts: drone internal_only + narrow lane 22개 ready
4. mvp_category_readiness DB row INSERT
5. DEFAULT_SEARCH_QUERIES 추가
6. fixture test 22개
