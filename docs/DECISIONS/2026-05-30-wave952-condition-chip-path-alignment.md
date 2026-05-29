# 2026-05-30 Wave 952 — Condition Chip Path Alignment

## Context

User asked whether condition/classification and chips are actually consistent.

Review found that the main paths already merge `condition_notes` with `condition_grade.chips`:

- `/api/packs/pool`
- `/api/packs/me`
- `pack-open`
- admin pool listings

But `/api/packs/pool/detail-access` still loaded only `parsed_json.condition_grade.chips`. That exact-item path could miss condition-note chips such as:

- `뒷판/프레임 파손`
- `힌지/내부액정 이상`
- `소리 이상`
- `오염/이염`

## Decision

Keep the product/SKU/category taxonomy unchanged. Condition chips are a separate display/evidence layer:

- Product identity remains catalog/category/lane based.
- Market grouping still uses `condition_class` and, for fashion lanes, condition-grade aligned comparable keys.
- UI chips merge `condition_grade.chips` and `condition_notes`.

## Change

- Added `condition_notes` fetch to `/api/packs/pool/detail-access`.
- Applied `mergeConditionDisplayChips()` there, matching the other user/admin paths.

## Verification

- `npx tsx --test tests/condition-display.test.ts tests/wave254-5-fashion-condition.test.ts tests/tech-device-condition-evidence.test.ts tests/earphone-condition-evidence.test.ts`
  - 152 pass / 0 fail
- `npm run build`
  - passed

## Deferred

- This does not claim every product category has a perfect deep-sweep ontology.
- Remaining future work is category-by-category expansion, especially categories outside earphone, tech-device, and fashion/shoe/bag.

