# Wave 1027 — feed thumbnail / comparison sample trust cleanup

Date: 2026-06-03

## Context

The product direction shifted toward higher-intent / higher-value users. In that model, hiding feed thumbnails creates more CTA loss than anti-leak value. The user also pointed out that beginner/easy mode needs visible comparison evidence early, but extreme outlier samples damage trust when shown as proof.

## Decisions

- Keep feed exploration free and high-hook: show real listing thumbnails first when available.
- Do not blur the feed image or show the SKU-image lock badge on `/me` pool cards.
- Keep easy-mode comparison evidence near the top, immediately after the money/verdict summary. Do not bury it under the detailed report.
- Add a display-level comparable outlier guard using the card market median and p25/p75 bounds. This does not change backend market-price calculation; it only prevents extreme high/low listings from appearing as visible evidence.
- Current Daangn distance policy is acceptable for known coordinates: near/reachable items are actionable up to 10km. Unknown geocode same-city fallback remains a deferred tightening candidate.

## Deferred

- Tighter Daangn unknown-distance handling: when user home region is known but listing geocode is unknown, consider excluding from primary feed instead of showing "거리 확인 필요".
- Further onboarding simplification: the "filtered tens of thousands" card is already removed; if the flow still feels long, reduce the remaining pre-budget explanation step rather than reintroducing pool stats.
- Server-side image processing/blur is not pursued now. It would add cost/latency, and the current high-intent model values clear thumbnails more.

## Verification target

- `npm run build`
- Manual UI check on `/me`: pool cards should prefer `thumbnailUrl` over `genericImageUrl`, with no blur/lock badge overlay.
- Easy/detail comparison lists should hide obvious extreme outliers while preserving same-source filtering for Daangn listings.
