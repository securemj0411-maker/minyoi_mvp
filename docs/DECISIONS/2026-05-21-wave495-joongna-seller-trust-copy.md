# Wave 495 — Joongna Seller Trust Interpretation Copy

Date: 2026-05-21 KST

## Context

User pointed out that showing `신뢰지수 440점대 · 거래후기 1건 · 안심거래 판매 1건` is not enough. The useful user question is not just "what are the numbers" but "is this seller signal strong enough to trust?"

## Decision

Joongna seller trust UI now keeps the raw evidence but adds a conservative interpretation:

- Low trust score or 1-2 reviews: "표본 적음" / not a strong trust signal.
- Medium trust or 3-9 reviews: basic history exists, but original reviews and payment conditions must be checked.
- High trust with 10+ reviews: seller trust signal exists, but still not a safety guarantee.
- No score and no reviews: insufficient evidence.

The copy avoids blanket claims like "믿을 만하다", "안전하다", or "보장된다". It explains whether the evidence is strong, limited, or missing, then tells the user what to confirm before purchase.

## Implemented

- Added Joongna seller trust assessment text in `src/lib/marketplace-safety.ts`.
- Updated beginner guide / Q&A / top safety tile to use the interpretation instead of just repeating metrics.
- Added a regression test for `신뢰지수 440점대 + 거래후기 1건 + 안심거래 판매 1건`.

## Deferred

- No new external seller risk scoring model was added.
- We did not change pool eligibility or fraud gates; this is UX interpretation only.
