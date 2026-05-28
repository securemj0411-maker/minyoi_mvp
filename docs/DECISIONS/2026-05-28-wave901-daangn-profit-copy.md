# Wave 901 - Daangn Profit Copy

Date: 2026-05-28

## Decision

Daangn profit UI must make it obvious that Daangn resale fee is `0원`, while the common safety buffer is still deducted from expected net profit.

The user reported a Daangn listing showing `매입 40,000원 · 시세 74,000원 · 예상 순익 29,000원`. The math is correct under the current model: `74,000 - 40,000 - 5,000 safety buffer = 29,000`. The UX problem was that the easy/detail copy grouped fees, reshipping, and buffer together, which made Daangn look like it was still deducting marketplace fees.

## Changes

- Easy-mode first money step now says `당근 수수료 0원 · 안전버퍼 반영` for Daangn.
- Easy-mode explanatory copy now says Daangn resale fee and reshipping are `0원`, and the safety buffer is the deduction.
- Detail profit card now adds a visible Daangn-only line: `당근 수수료 0원 · 안전버퍼 5,000원 차감`.
- Calculation-basis formula now uses `안전버퍼 5,000원` instead of generic `비용` for Daangn.
- Added a focused copy contract test for Daangn profit wording.

## Deferred

- The safety buffer policy itself remains unchanged. If the business decision changes to show gross gap instead of expected net profit for Daangn, that should be a separate pricing/profit-model wave.
