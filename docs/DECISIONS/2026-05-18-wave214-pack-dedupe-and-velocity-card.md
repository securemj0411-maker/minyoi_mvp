# 2026-05-18 Wave 214 — Pack open diversity and `/me` velocity surface

## Problem
- Pack open only excluded exact `pid` rows already revealed to the user.
- Different listings with the same model/options, such as multiple `iPad Pro 11 M5 256GB unopened` rows, could be revealed again because their pids differ.
- `/me` cards still had text verdicts like `2시간 회전` / `매물 활발`, but the visual liquidity mini-chart was only visible inside the replay modal.

## Decision
- `openPack()` now loads the current user's recent reveal identity set before selecting final cards:
  - revealed pids
  - revealed `comparable_key`s
  - revealed `sku_id`s as fallback when a comparable key is missing
- During final pack assembly, candidates are released instead of shown when:
  - the same pid was already revealed,
  - the same comparable key was already revealed to this user,
  - another candidate in the same pack already used the same comparable key,
  - or, for unparsed candidates, the same SKU was already used.
- This keeps the DB pool intact while preventing duplicate-looking recommendations from reaching the user.
- `/me` card rows now render `LiquidityCurveMini` directly, so the rotation/velocity visual is visible without opening the modal.

## Deferred
- Moving comparable-key dedupe into `reserve_mvp_pool_candidates` would reduce short-lived reserve/release churn further. This wave keeps the fix in `openPack()` to avoid RPC signature drift while preserving user-visible correctness.
