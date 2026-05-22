# Wave 658 — Polo Pique 빅포니 성조기 + Acne Denim 상단 outlier (clothing v29→v30)

## Polo Pique c_grade (6건, spread 6.9x)

| pid | name | price |
|-----|------|-------|
| 409175157 | [XL] 폴로 랄프로렌 USA 빅포니 성조기 미국 pk 반팔 카라티 | 145,000 |
| 409358417 | 폴로 빅포니 성조기 벤쿠버 한정 PK 티셔츠 | 110,000 |
| 408211553 | 폴로 희귀 빅포니 PK 카라티 화이트 | 89,000 |

일반 polo pique = 45~60k. 빅포니 성조기 한정 110~145k (Olympic / USA / Vancouver chapter).

## Acne Denim b_grade (26건, spread 13.6x)

| pid | name | price |
|-----|------|-------|
| 406773235 | (정품) 아크네 스튜디오 Acne Studios 블랙 진 데님 팬츠 | 330,000 |
| 321344659 | 아크네 디스 데님 팬츠 | 200,000 |

상단 outlier 2건만 invalidate. acne_denim broad SKU 광범위 → 추가 narrow는 후속 wave.

## 조치

1. **catalog polo_pique_classic** mustNotContain 추가:
   - `빅포니 성조기` / `성조기 빅포니` / `usa 빅포니` / `벤쿠버 한정` / `희귀 빅포니`
   - `성조기 pk` / `team usa` / `올림픽 한정`
2. **invalidate**: 5 pids (2 acne + 3 polo) priority 88~90.
3. **parser**: `wave216-clothing-v29` → `v30`.

## Why

빅포니 성조기 라인은 USA chapter store 한정 + Olympic collab 시즌 → 일반 polo pique 시세 2~3배. broad SKU에 흘려보내면 c_grade spread 부풀림.

## How to apply

미국 chapter store 또는 도시 한정 매물은 별도 시세군. 패턴 매물 발견 시 차단어 추가 + 풀 확보되면 narrow SKU 신설 고려.
