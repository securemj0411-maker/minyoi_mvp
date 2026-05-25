# 2026-05-25 teaser product-line Korean labels

## Context
- The new teaser feed intentionally hides exact title/source/price, but still shows a product-line hint.
- That hint came from catalog `sku_name`, so many cards displayed English-heavy labels such as `Nike Dunk Low`, `Louis Vuitton LV Trainer`, and `Adidas Gazelle OG`.
- This felt inconsistent with the Korean user-facing feed, especially because these are market-common Korean terms.

## Decision
- Add a display-only product-line localization layer for teaser labels.
- Keep catalog keys, parser aliases, comparable keys, and exact detail titles unchanged.
- Localize common brand/model/shape words before appending `계열`.
- Preserve unavoidable model tokens such as `M4`, `256GB`, `OG`, `LV8`, etc.

## Examples
- `Nike Dunk Low` → `나이키 덩크 로우`
- `Nike Air Force 1 LV8` → `나이키 에어포스 1 LV8`
- `Louis Vuitton LV Trainer` → `루이비통 LV 트레이너`
- `MacBook Air M4 13" 256GB` → `맥북 에어 M4 13" 256GB`

## Deferred
- This is not a full catalog translation project.
- If a future category has awkward labels, add to the display mapping instead of changing parser identity fields.
