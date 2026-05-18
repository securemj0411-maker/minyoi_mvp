# 2026-05-18 Wave 217 — modal sticky actions and plain sale-speed wording

## Problem
- The main modal actions (`상세 비교`, `공략 보기`, `번개장터 열기`, inaccurate info report) lived at the bottom of the card content.
- Users could scroll through the market analysis and lose the action buttons.
- The velocity/liquidity copy used internal terms like `회전`, `medium`, and `SKU sold`, which normal users may not understand.

## Decision
- The action block inside `PackRevealModal` is now sticky at the bottom of the scrollable modal content.
- The sale-speed section now says what users care about directly: similar products usually sold within a given number of hours/days.
- Confidence labels are localized (`신뢰 높음`, `신뢰 보통`, `참고용`).
- Liquidity curve wording now uses plain Korean:
  - `이 가격이면 얼마나 빨리 팔릴까?`
  - `비슷한 상품은 보통 N 안에 팔렸어요`
  - `5% 싸게/비싸게 팔면`

## Deferred
- The modal still has per-card sticky actions because pack-open can show multiple cards. If we later redesign the modal around a single selected card, move these actions into a global modal footer.
