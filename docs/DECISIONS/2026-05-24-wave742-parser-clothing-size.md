# Wave 742 — 의류 사이즈 추출 parser 신설

**날짜**: 2026-05-24

## 배경
Wave 727-741 의류 catalog 14 wave 후속. parser audit 결과 발견:

| 항목 | 상태 |
|------|------|
| condition_tier (S/A/B/C/D) | ✅ 87.1% catch (wave216-clothing-v46) |
| parsed_json.condition_grade | ✅ snake_case로 박힘 (camelCase 아님) |
| **clothing_size_alpha / kr / waist_inch** | ❌ **부재** |
| shoe size (parseShoeSizeMm) | ✅ 92.7% catch |

의류 사이즈 부재로 시세 정확도 손실 (M/L/XL 시세 차이 못 잡음).

## 신설 함수

### parseClothingSizeAlpha(text) → "XS/S/M/L/XL/XXL/XXXL/FREE" | null
4 패턴 (conservative — bare alpha 차단):
1. `사이즈 X` / `size X`
2. `X사이즈` / `Xsize`
3. `(X)` / `[X]` / `{X}` — bracket
4. (5번 제거됨 — bare "L" 단독 모델명 false positive)

Normalization: F→FREE, 2XL→XXL, 3XL→XXXL

### parseClothingSizeKr(text) → 85/90/95/100/105/110/115 | null
- `사이즈 100` / `100 사이즈/호수/호` / `(105)` / `M/100` slash 표기

### parseClothingWaistInch(text) → 26-44 | null
- `32인치` / `28x30` (denim waist×inseam)

## Integration
parseFashionMobility의 의류 branch (라인 1135 직후):
- title-only 우선 (description은 검색 노출 cross-size noise)
- pants/shorts/jeans만 waistInch 추출 (의류엔 사이즈 의미 없음)
- 각 사이즈 추출 성공 시 parseConfidence +0.05

## Smoke test 13/14 pass
✗ bare "L 새상품" → null (의도된 안전 — 모델명 false 차단)
✓ 모든 bracket/suffix/explicit/호수/inch 패턴

## Parser version bump
`wave216-clothing-v46` → `wave216-clothing-v47`

## 영향
- 의류 시세 정확도 향상 (M/L/XL 시세 분리 가능)
- raw_text_length < 50 매물도 사이즈 신호로 confidence boost
- production reparse 시 17K+ 의류 매물에 새 size 박힘
- mvp_market_price_daily에 size 별 시세 grouping은 별 wave (현재는 unused, parsed_json에만 저장)

## Pending
- Wave 743+: parsed_json.clothing_size_* 를 comparable_key/variant_key에 반영하여 시세 grouping
- 또는 mvp_market_price_daily에 size column 추가 (size 별 median)
