# Wave 945 — Game/Golf pool cleanup

Date: 2026-05-29

## Context

After the earphone and fashion pool cleanups, we checked the remaining
categories that use newer product/condition structure: `sport_golf` and
`game_console`.

## Decision

- Use the same current reparse cleanup path for game/golf ready/reserved rows.
- Treat game-console comparable-key drift as an immediate pool rebuild issue,
  because old broad keys like `game_console|playstation_5` mix disc and digital
  PS5 rows, and old Switch keys mix OLED/full-set/accessory lanes.
- Golf had no current cleanup candidates in this pass.

## Apply Summary

Dry-run before apply:

- scanned pool rows: 90
- candidate rows: 6
- invalidate pool rows: 6
- categories: game_console 6
- primary reason: parser_version_stale 6

Applied:

```bash
npx tsx scripts/apply-cross-category-current-reparse-cleanup.ts \
  --categories=sport_golf,game_console \
  --statuses=ready,reserved \
  --reason=wave945_game_golf_pool_key_review \
  --apply
```

Affected examples:

- Nintendo Switch row previously under Joy-Con/accessory or old OLED key now rebuilds to `game_console|nintendo_switch|...`.
- PS5 disc/digital rows previously sharing `game_console|playstation_5` now rebuild to disc/digital-specific full-set keys.

## Verification

Post-apply dry-run:

- scanned pool rows: 84
- candidate rows: 0
- invalidate pool rows: 0

## Deferred

- No parser/catalog code changes were needed for game/golf in this pass.
- Continue category-specific language-pattern deepsweeps separately; this wave only cleaned exposed ready/reserved key drift.
