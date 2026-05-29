# Wave 967 — Condition Haircut UI Exposure

Date: 2026-05-30 KST

## Context

Wave 966 applied soft-condition resale haircuts to profit calculations. Without UI exposure, a user could see:

- visible condition chips
- a market median
- a lower expected profit

but not understand that the difference came from a conservative condition adjustment.

## Decision

Expose the condition haircut in the detail cost basis:

- `costAssuranceSnapshot` computes `conditionAdjustment` from the same soft-chip policy.
- Selling fee is calculated from the adjusted resale basis.
- The detailed cost table shows a `상태 보정` row when the haircut is positive.
- The formula line includes `상태 보정` before subtracting buy cost and resale costs.
- Beginner/easy money summary shows a compact `상태 보정 -N 포함` footnote when relevant.

This keeps the profit number explainable without expanding the easy mode into a dense accounting table.

## Verification

Local verification:

```bash
npx tsx --test --test-name-pattern "condition profit|condition chip policy|comparison rows expose|detail cost basis" tests/condition-profit-adjustment.test.ts tests/condition-chip-policy.test.ts tests/detail-beginner-guide-contract.test.ts
npm run build
```

Result:

- targeted tests: 10 pass, 0 fail
- production build: passed

## Deferred

- Exact per-chip market median remains deferred.
- If the detail cost table becomes too dense on mobile, only the formula line and easy-mode footnote should remain visible while the row moves into an expandable calculation section.
