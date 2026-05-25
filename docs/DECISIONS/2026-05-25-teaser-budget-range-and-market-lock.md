# 2026-05-25 teaser budget range and market lock

## Context
- The teaser feed was showing `매입 90만원대 · 시세 110만원대`.
- This is fun, but it also gives too many reverse-search clues when combined with thumbnail, category, and registration time.
- The hook still needs real money, otherwise the feed feels abstract and weak.

## Decision
- Keep expected profit concrete in the feed: `약 +15만원`.
- Replace exact-ish buy price bands with wider budget ranges: e.g. `90~120만원`, `20~40만원`, `15만원 이하`.
- Hide market price in locked teaser cards as `정확 시세 잠김`.
- Show exact buy price and market price only after detail access.

## Range Policy
- Low price items are grouped coarsely enough to avoid easy search (`4만원` → `15만원 이하`).
- Mid-price items get narrower practical ranges (`30만원` → `20~40만원`).
- High-price items get wider but still useful ranges (`110만원` → `90~120만원`).

## Deferred
- Exact paywall copy and pricing page changes remain a separate wave.
- Market-price evidence order inside the detail modal remains unchanged.
