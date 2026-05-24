# Wave 768 — Premium brand min price floor 확장 (RRL/Acne/Stone Island/Supreme)

**날짜**: 2026-05-24
**Wave**: 768 (Wave 767 후속 — 사용자 "할거 계속")
**Owner**: Claude

## 추가 적용 SKU (10개)

| SKU | minPriceKrw | 의도 |
|---|---|---|
| `polo_rrl_knit` | 80K | RRL 니트 정품 최저 |
| `polo_rrl_jacket_leather_suede` | 300K | RRL 가죽자켓 premium |
| `polo_rrl_grizzly_jacket` | 200K | RRL 그리즐리 premium |
| `acne_sweat` | 30K | Acne 맨투맨/후디 가품 차단 |
| `acne_jacket_coat` | 50K | Acne 자켓/코트 |
| `acne_knit` | **30K** | **사용자 #6 발견 15K 매물 차단** |
| `stone_island_shadow_project` | 100K | Shadow Project premium |
| `stone_island_ghost_piece` | 80K | Ghost Piece premium |
| `stone_island_crinkle_reps` | 100K | Crinkle Reps premium |
| `supreme_box_logo` | 100K | 슈프림 박스 로고 가품 다수 |

총 누적: Wave 767 (11) + Wave 768 (10) = **21 premium SKU floor 적용**.

## 효과

- Acne knit 15K outlier (사용자 #6 발견) 같은 가품 매물 자동 차단
- Supreme Box Logo 가품 (한국 다수) 시세 sample 오염 방지
- Stone Island 명품 sub-line floor — sample 정확성 향상

## 안전성

- minPriceKrw 미박힘 SKU 기존 동작 유지
- pipeline.ts categoryScopedNoise universal 검사 (Wave 767 박힘)
- 정상 차익 매물도 소량 차단 가능 trade-off — 가품 차단 이익 더 큼

## 관련 commit

- `97079e33`: Wave 767 — 11 SKU floor + 4 broad hold
- 본 commit: Wave 768 — 10 SKU floor 확장
