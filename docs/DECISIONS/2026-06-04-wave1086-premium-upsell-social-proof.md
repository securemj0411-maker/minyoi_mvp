# 2026-06-04 Wave 1086 - Premium Upsell And Plans Social Proof

## Decision
- The feed should no longer promote friend referral credits because the product has moved to a capped premium membership model.
- Feed upsell should reinforce plan length / seat reservation instead of public sharing rewards.
- Plans page social proof should use real approved membership events when available and safe fallback seat-check/reservation events when real events are sparse.

## Implemented
- Replaced the feed referral banner with a one-hour membership upsell card.
- Replaced the refresh modal Kakao share CTA with the same membership upsell card.
- Added `/plans` floating social proof toasts, shown about three times per ten minutes.
- Real approved applications show membership completion; fallback events avoid claiming fake payment completion.

## Deferred
- Legacy referral routes and Kakao share bonus backend paths remain in code for now but are no longer surfaced in the primary feed.
