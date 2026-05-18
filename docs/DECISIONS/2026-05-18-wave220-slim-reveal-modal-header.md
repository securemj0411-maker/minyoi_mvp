# 2026-05-18 Wave 220 — slim reveal modal header

## Problem
- The reveal modal header used a tall hero-like layout:
  - profit-band pill
  - large title
  - separate explanatory copy
  - large close button
- This consumed vertical space that should be used for product and market information.

## Decision
- Remove the profit-band pill from the modal header.
- Compress the header to a thin one-line bar with title, short context copy, and a smaller close button.
- Keep the header sticky but reduce padding and remove decorative gradient/radial background.

## Deferred
- If multi-card pack-open results need band context, show the band near each card or in the pack-opening controls instead of the modal header.
