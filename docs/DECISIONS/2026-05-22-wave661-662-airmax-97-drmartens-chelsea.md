# Wave 661-662 — Air Max 97 OG 실버불렛 + Dr. Martens 2976 Chelsea outlier (shoe v21→v23)

## Wave 661 — Air Max 97 270 b_grade (7건, spread 5.03x)

| pid | name | price |
|-----|------|-------|
| 373762521 | 나이키 에어맥스97 og 실버불렛 270 | 200,000 |
| 397534043 | 나이키 에어맥스 97 블랙 화이트 앤트러사이트 | 105,000 |
| 395659930 | 나이키 에어맥스 97 파티클 베이지 270 | 95,000 |
| 409150349 | 나이키 에어맥스 97 올블랙 남성운동화270 | 90,000 |
| ... | (정상 b_grade) | 55,000~39,790 |

상단 outlier 1건 (실버불렛 OG 200k). 일반 b_grade = 50~105k.

차단어:
- `실버불렛` / `silver bullet` / `og 실버`
- `1997 og` / `og 1997`

## Wave 662 — Dr. Martens 2976 Chelsea 260 c_grade (8건, spread 4.17x)

| pid | name | price |
|-----|------|-------|
| 409422121 | 닥터마틴 첼시부츠 (블랙/브라운) | 250,000 |
| 372340523 | 닥터마틴 메이볼 첼시부츠 | 150,000 |
| 392937215 | 닥터마틴 260 플로랄 첼시부츠 SE13 | 85,000 |
| ... | (정상 c_grade) | 109k~60k |

상단 outlier: 다중 색상 묶음 + Maybelle (Pascal) variant + Floral SE13.

차단어:
- `메이볼` / `maybelle` / `pascal maybelle` (별도 라인)
- `se13` / `플로랄` (Floral SE13 변형 — Wave 537 flora 보완)
- `블랙 브라운` / `블랙/브라운` (다중 색상 묶음 매물)

## 조치

1. **catalog**: 두 SKU 각각 mustNotContain 추가.
2. **parser**: `wave92-shoe-v21` → `v22` → `v23` (두 wave 연속).
3. **tick-pipeline**: `shoe` → `v23`.
4. **invalidate**: 두 comparable_keys priority 88~95.

## Why

OG 한정 colorway (실버불렛 1997 데뷔)는 retro reissue 시세 +50~100%. 일반 broad에서 차단해 spread 보호.

Dr. Martens variant (Maybelle/Floral/Vegan/Vintage)는 별도 라인 — broad 2976 chelsea 시세와 별개.

## How to apply

retro/OG reissue colorway는 빈티지 시세 분리. Dr. Martens variant 패턴 매물은 차단 catch-all 누락 확인.
