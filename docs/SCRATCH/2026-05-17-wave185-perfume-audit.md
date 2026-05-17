# Wave 185 — 향수 audit (새 카테고리 "perfume")

## 새 카테고리
- `perfume` (새 enum)
- readiness: **internal_only** 시작
- narrow lane 22개 ready (가장 인기 향 + 용량)

## 옵션
- **용량 (volumeMl)**: 10 / 30 / 50 / 75 / 100 / 200ml — 시세 영향 큼 (50ml vs 100ml 가격 2배). parser 추출 필수.
- **사용량**: 100% 미개봉 / 90% / 70% — condition_class 흡수 (normal/clean/worn).

## 짝퉁 risk
- 명품 가방보다 낮지만 일부 있음 (병/뚜껑/박스 식별 가능).
- mustNotContain: "분주", "소분", "리필", "샘플", "vial", "빈병"

## 라인업 (인기 향 22개, 100ml or 50ml 기준)

### Jo Malone (5)
| SKU id | 향 | 용량 |
|---|---|---|
| jo-malone-wood-sage-sea-salt-100 | Wood Sage & Sea Salt | 100ml |
| jo-malone-lime-basil-mandarin-100 | Lime Basil & Mandarin | 100ml |
| jo-malone-english-pear-freesia-100 | English Pear & Freesia | 100ml |
| jo-malone-blackberry-bay-100 | Blackberry & Bay | 100ml |
| jo-malone-peony-blush-suede-100 | Peony & Blush Suede | 100ml |

### Le Labo (3)
| jo-malone-* | Santal 33 (50ml/100ml) | |
| le-labo-santal-33-50 | Santal 33 | 50ml |
| le-labo-santal-33-100 | Santal 33 | 100ml |
| le-labo-noir-29-50 | The Noir 29 | 50ml |

### Diptyque (3)
| diptyque-philosykos-75 | Philosykos | 75ml |
| diptyque-do-son-75 | Do Son | 75ml |
| diptyque-eau-capitale-75 | Eau Capitale | 75ml |

### Tom Ford (4)
| tom-ford-black-orchid-50 | Black Orchid | 50ml |
| tom-ford-tobacco-vanille-50 | Tobacco Vanille | 50ml |
| tom-ford-lost-cherry-50 | Lost Cherry | 50ml |
| tom-ford-oud-wood-50 | Oud Wood | 50ml |

### Maison Margiela Replica (4)
| replica-jazz-club-100 | Jazz Club | 100ml |
| replica-by-the-fireplace-100 | By the Fireplace | 100ml |
| replica-beach-walk-100 | Beach Walk | 100ml |
| replica-when-the-rain-stops-100 | When the Rain Stops | 100ml |

### Memo Paris (3)
| memo-russian-leather-75 | Russian Leather | 75ml |
| memo-irish-leather-75 | Irish Leather | 75ml |
| memo-italian-leather-75 | Italian Leather | 75ml |

**총 22 인기 향 narrow lane.**

## parser 보강
- `parseVolumeMl(text)`: 10ml / 30ml / 50ml / 75ml / 100ml / 200ml 추출
- `option-parser.confidence`: perfume 카테고리 +0.35

## mining query
- "조말론" / "Jo Malone" + 각 향
- "르라보" / "Le Labo" + Santal 33 / Noir 29
- "딥디크" / "Diptyque" + Philosykos / Do Son / Eau Capitale
- "톰포드" / "Tom Ford" + Black Orchid / Tobacco Vanille / Lost Cherry / Oud Wood
- "메종 마르지엘라" / "Replica" + Jazz Club / By the Fireplace / Beach Walk
- "메모" / "Memo Paris"
