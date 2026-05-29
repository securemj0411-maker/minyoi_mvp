# Wave 965 — Comparable Condition Chip Visibility

Date: 2026-05-30 KST

## Context

Wave 964 made hard condition chips affect which rows are eligible as visible comparison proof. The API already returned `conditionChips` per comparable row, but the detail UI did not show those chips inside the comparison list.

That left a trust gap: users could see "same condition" and row price, but not the concrete condition signals such as missing parts, low battery, stains, hygiene warnings, or premium proof.

## Decision

Expose compact condition chips in comparison rows:

- Detailed numeric report: show up to 2 chips under each comparable row when present.
- Beginner/easy comparison preview: show the same compact chip line so the first-page trust proof is visible.
- Keep chip rendering compact with small pill sizing to avoid turning the comparison list into a noisy tag wall.

No pricing or filtering behavior changed in this wave.

## Verification

Local verification:

```bash
npx tsx --test --test-name-pattern "comparison rows expose|market source API|condition chip policy" tests/detail-beginner-guide-contract.test.ts tests/condition-chip-policy.test.ts
npm run build
```

Result:

- targeted tests: 7 pass, 0 fail
- production build: passed

## Deferred

- Soft chips are still not exact market split keys.
- Profit penalties for soft chips such as missing accessories, low battery, and stains remain a separate policy wave.
- If the chip line feels visually noisy on mobile, the next UI pass should show only negative/neutral chips in comparison rows and leave positive proof for the main item header.
