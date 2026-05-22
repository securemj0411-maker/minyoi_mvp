# 2026-05-22 Wave 540 — Polo Oxford boys/youth size hold

## Context

- Recent ready pool audit showed `pid=407451001`: `폴로 랄프로렌 옥스포드 셔츠 14~16`.
- Active raw rows also included `보이즈l` and `폴로 보이즈 화이트 옥스포드 셔츠`.
- These are likely boys/youth Polo Oxford shirts, not the adult standard Oxford lane, and can distort adult-shirt resale comps.

## Decision

- Add `보이즈` / `boys` / `주니어` / `youth` / `14~16` / `14-16` to the adult Polo Oxford SKU blocklist.
- Bump clothing parser freshness to `wave216-clothing-v21` so existing adult-Oxford parsed rows are forced through the stricter catalog rule.

## Deferred

- No separate boys/youth Polo Oxford lane in this wave.
- Reconsider only if boys/youth rows become dense enough for a separate clean market sample.
