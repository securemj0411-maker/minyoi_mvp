# 2026-05-30 Wave 953 — Beginner Condition Chip Visibility

## Context

User asked where condition chips are visible and whether they show in the detail page or easy-view modal.

Before this wave:

- Normal detailed modal already showed condition tier/chips above the listing title.
- Feed/dashboard/admin paths also rendered chips.
- Beginner/easy view only showed a broad condition label in the product visual, so evidence chips like `오염/이염`, `뒷판/프레임 파손`, `소리 이상` were not obvious.

## Change

- Added condition tier/chip row to the beginner/easy view trust step under the headline.
- Added compact condition tier/chips on the beginner/easy view product image overlay.
- Kept the detailed numeric report chip placement unchanged.

## Decision

Condition chips should be visible in both:

- detailed report mode, where users inspect the full numbers;
- beginner/easy mode, where users need fast purchase-risk context without opening debug-like details.

## Verification

- `npm run build`
  - passed

