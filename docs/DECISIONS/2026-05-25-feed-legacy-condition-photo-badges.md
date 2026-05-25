# 2026-05-25 feed legacy condition photo badges

## Context
- New-tier categories (`shoe`, `clothing`, `game_console`, `sport_golf`) already show S/A/B/C/D photo badges in the feed.
- Legacy `condition_class` categories only showed photo badges for `unopened` and `mint`; `clean`, `normal`, `worn`, `flawed`, and `low_batt` mostly appeared as smaller text chips below the card.
- This made the feed feel inconsistent.

## Decision
- Locked feed cards now show a photo badge for every legacy `condition_class` when the item is not in a latest-tier category.
- Latest-tier categories keep using `ConditionTierPhotoBadge` only.
- Legacy categories use `ConditionPhotoBadge` only.
- The lower plain condition chip is removed from feed cards to avoid duplicate grade signals.

## Notes
- The two systems remain separate because their meanings differ:
  - latest tier: S/A/B/C/D score from the newer category-specific grading.
  - legacy condition: unopened/mint/clean/normal/worn/flawed/low_batt.
