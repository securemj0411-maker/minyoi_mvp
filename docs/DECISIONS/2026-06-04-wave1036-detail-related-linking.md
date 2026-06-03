# Wave 1036 — Detail Related Linking

## Context

User reviewed the detail modal comparable/related item area and found two UX mismatches:

- Tiny "원문 보기" buttons are hard to click in detailed/easy mode evidence rows.
- Related items below an already opened detail still used feed teaser masking, causing blur/watermark/"상세에서 공개" copy that no longer matches the opened-detail context.

## Decision

- Make each comparable evidence row itself link to the original listing.
- Keep a small "원문 열기" affordance only as a visual hint, not the sole click target.
- In the detail modal related strip, ignore feed `locked` masking and show the related card image/title/profit normally.

## Changes

- `ComparableListingsPanel` rows now render as full-row external links.
- `RelatedRevealStrip` no longer applies blur, dark overlay, "상세에서 공개", or hidden profit state from `item.locked`.
- Added/updated contract tests to lock the new behavior.

## Deferred

- The feed itself still uses teaser masking before detail access. This change only affects opened detail modal context.
