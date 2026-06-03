# Wave 1040 — membership gates and admin review queue

## Trigger

User found that a non-member could still click into the recommendation/feed surface and market lookup. User also wanted the obfuscated cau operator page to approve or reject membership applications, with old credit-grant UI removed from that page.

## Decision

- Recommendation/feed access is now membership-gated before home-region onboarding:
  - `/` logged-in branch redirects non-members to `/plans?from=feed`.
  - `/me` redirects non-members to `/plans?from=me`.
  - `/api/packs/pool` and `/api/packs/me` return `membership_required` for non-members.
- Market lookup is membership-gated:
  - `/lookup` redirects guests/non-members to the login/application flow.
  - `/api/lookup/by-url` returns `membership_required` for non-members and no longer spends credits.
- Main navigation no longer shows "내 대시보드".
- Membership applications are stored in `mvp_membership_applications`.
- cau operator page now shows a membership application review panel.
  - Approve grants a 90-day `pro` row in `mvp_user_plans`.
  - Reject closes the application without granting access.
  - The old manual-deposit panel was removed from the cau landing page.
  - Member drawer credit grant/revoke UI was removed.

## Deferred

- Legacy credit tables/functions/APIs remain in the codebase for historical data and unrelated flows, but they are no longer surfaced in the cau member drawer or lookup flow.
- The 30만원 upsell plan and final pricing table remain product strategy work, not implemented in this wave.
