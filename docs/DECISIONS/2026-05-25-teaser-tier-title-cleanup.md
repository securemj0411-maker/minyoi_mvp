# 2026-05-25 teaser tier title cleanup

## Context
- Feed teaser cards were showing two condition systems at once.
- Example: photo badge showed latest `condition_tier=S`, while the teaser title still appended old `condition_class=clean` as `A급`.
- This was most visible on categories whose grading changed during parser waves: shoe, clothing, game console, and golf.

## Decision
- For latest-tier categories (`shoe`, `clothing`, `game_console`, `sport_golf`), teaser titles no longer append the old condition label.
- The S/A/B/C/D photo badge is the only visible condition-grade signal for those categories.
- Client fallback titles use the same rule, so cached or partial API items do not reintroduce `· A급 후보`.
- Game console and golf now share the same tier-badge path as shoe/clothing.

## Deferred
- Charge-page copy and price-pack changes remain a separate wave.
- Full parser taxonomy cleanup is not included here; this change only prevents mixed-condition UI on the feed teaser cards.
