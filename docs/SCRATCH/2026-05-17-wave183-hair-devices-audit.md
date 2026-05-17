# Wave 183 — 헤어 기기 audit (home_appliance 확장)

## 라인업 (9년 정책 이내, 2017+)

### Dyson (다이슨)
| SKU id | 모델 | 출시 | 옵션 | base |
|---|---|---|---|---|
| dyson-supersonic-hd08 | Dyson Supersonic (HD08, HD15) | 2018 (한국) | 단일 (색상 변형) | n/a |
| dyson-supersonic-origin | Dyson Supersonic Origin (HD13) | 2023 | 단일 (저가형) | n/a |
| dyson-airwrap-hs05 | Dyson Airwrap Multi-styler Complete (HS05) | 2022 | 단일 (Long/Short 변형) | n/a |
| dyson-airwrap-id | Dyson Airwrap i.d. (HS08, Co-anda 2x) | 2024 | 단일 | n/a |
| dyson-corrale-hs07 | Dyson Corrale (무선 고데기, HS07) | 2020 | 단일 | n/a |

### 시아루스 (Cyaars)
| SKU id | 모델 | 출시 | 옵션 |
|---|---|---|---|
| cyaars-glampam | 시아루스 글램팜 | 2021+ | 단일 (다양 시즌) |
| cyaars-magic-prov | 시아루스 매직 ProV | 2022+ | 단일 |

### 파나소닉 (Panasonic)
| SKU id | 모델 | 출시 | 옵션 |
|---|---|---|---|
| panasonic-eh-na0j | EH-NA0J (나노이 + 미네랄) | 2021 | 단일 |
| panasonic-eh-na9c | EH-NA9C (나노이) | 2019 | 단일 |
| panasonic-eh-na98 | EH-NA98 | 2018 | 단일 |

### 바비리스 (BaByliss)
| SKU id | 모델 | 출시 | 옵션 |
|---|---|---|---|
| babyliss-pro-2174u | BaByliss Pro 2174U 파마기 | 2020 | 단일 |

**총 11 SKU 후보.**

## 옵션 분석
- **단일 옵션**: 색상 변형은 시세 동일 (브랜드 광고용 변형).
- **base option fallback 불필요**.
- **parser 보강 불필요**: 기존 parser 모델명 매칭으로 OK.

## 짝퉁 risk
- **Dyson 일부** (특히 Airwrap, Supersonic) — 박스/시리얼/홀로그램으로 식별. mustNotContain "이미테이션", "정품 아님" 박기.
- 시아루스/파나소닉/바비리스 거의 없음.

## 운영 risk
- "필터만", "노즐만", "어댑터만" 단품 매물 (부품) — mustNotContain.
- "수리", "고장", "충전 안됨" — mustNotContain.

## mining query
- "다이슨 슈퍼소닉", "Dyson Supersonic"
- "다이슨 슈퍼소닉 오리진", "Origin"
- "다이슨 에어랩", "Dyson Airwrap"
- "다이슨 에어랩 i.d.", "Airwrap iD"
- "다이슨 코랄", "Corrale"
- "시아루스", "글램팜", "매직 ProV"
- "파나소닉 나노이", "EH-NA0J", "EH-NA9C", "EH-NA98"
- "바비리스 프로"
