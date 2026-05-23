# Wave 732 — Multi-brand apparel broad 6 SKU 신설

**날짜**: 2026-05-24
**Owner**: Claude

## 배경
Wave 730-731 follow-up. 나머지 Pareto brand 중 false-positive 정제.

## False positive (skip)
- **K2** 125건: 자전거 brand (K2BIKE) + 안전화 (K2 Safety) — 의류 X
- **ami_paris** 147건: 닌텐도 amiibo (아미보) + BY FAR 아미라 + Aime Leon Dore (아미네) — 100% false
- **zara** 160건: 신발/구두/가방 위주 — 의류 거의 없음
- **anderson_bell** 66건: 가방/Asics x Anderson 신발 collab 위주
- **nepa**: 1건만 의류 — 풀 너무 작음

## 신설 6 SKU (~107건 회수)
| SKU | 건수 | p50 | 비고 |
|-----|------|-----|------|
| mlb_nike_jersey_collab | 54 | 12.5만 | mlb_apparel_broad가 nike 차단 → leak. 야구 져지/유니폼 |
| uniqlo_collab_broad | 17 | 4.9만 | Lemaire/Marimekko/JW Anderson/Theory |
| thisisneverthat_apparel | 15 | 5만 | 디스이즈네버댓 broad (T로고/후드) |
| columbia_apparel_broad | 9 | 6.2만 | 패딩/플리스 |
| blackyak_apparel_broad | 8 | 6.3만 | 다운/패딩 |
| barbour_quilted_jacket | 4 | 10.5만 | 퀼팅 자켓 시그니처 |

## 정책 부합
- 모두 일반인 친화 가격대 5-15만
- 한국 아웃도어 (columbia/blackyak)는 안전화/등산화 noise 강력 차단
- Barbour 첼시 부츠/벨스타프 차단 (별 브랜드)
- 디스이즈네버댓 phone case/시계 collab 차단

## Skip → Wave 733+
- K2/ami_paris/zara/anderson_bell — 의류 pool 너무 작거나 brand 단어 false
- Nike Tech Fleece signature (Wave 730 후속)
- Stussy x Nike leak (51건, Wave 731+ TBD)
- Sacai/CDG/언더커버 x Nike collab (19건)
