# Wave 487 — TNF Nuptse and outerwear product-type cleanup

## Context

After Polo Pique cleanup, active current-diff showed `clothing-tnf-nuptse-1996` stale rows:
generic/novelty/700/1992 Nuptse jackets were still in the 1996 lane, while vest/eco/shirt variants needed to leave the 1996 comparable group.

## Decisions

- Extended jacket/down-jacket product-type mismatch protection to reject shirt/tee/polo/pique variants.
  - Example: `노스페이스 눕시 셔츠` no longer enters Nuptse down-jacket pricing.
  - Example: `몽클레어 블루 반팔 카라티` no longer enters Moncler broad outerwear pricing.
- DB rematch for active `clothing-tnf-nuptse-1996` stale rows:
  - 85 rows moved to `clothing-tnf-nuptse-broad` (`TNF Nuptse 일반 다운자켓 (1996 외)`).
  - 37 rows cleared to `sku_id=null` (vest/eco/shirt-like variants).
- DB cleanup for active `clothing-moncler-broad` stale polo/PK/collar-shirt rows:
  - 14 rows cleared to `sku_id=null`.

## Verification

- Targeted `clothing-tnf-nuptse-1996`: 39 active rows, current-diff 0
- Targeted `clothing-tnf-nuptse-broad`: 113 active rows, current-diff 0
- Targeted `clothing-moncler-broad`: 187 active rows, current-diff 0
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts` — pass 187/187
- `npx tsx --test tests/core-rules.test.ts` — pass 101/101

## Deferred

- Eco Nuptse, Nuptse vest, and Moncler polo/PK shirts should get separate lanes only after clean repeat samples are enough.
  Until then they stay out of high-variance down-jacket/outerwear comparables.
