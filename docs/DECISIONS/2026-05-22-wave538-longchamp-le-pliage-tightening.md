# 2026-05-22 Wave 538 — Longchamp Le Pliage tightening

## Context

- Recent public ready fashion sample audit had one bag row in `longchamp_le_pliage` with `unknown_size_variant`.
- The catalog rule also allowed generic `롱샴 + 토트/숄더/백/핸드백` wording to match Le Pliage, which could pull non-Pliage Longchamp bags into the same lane.
- This is the same class of risk as prior bag pollution: wallets, shoulder bags, backpacks, and loose bag shapes sharing one comparable group.

## Decision

- Require explicit Le Pliage line text (`pliage` / `플리아쥬` / `르 플리아쥬`) for the Longchamp SKU.
- Public candidate pool now holds Le Pliage rows whose comparable key still has `unknown_size_variant`.
- Bump bag parser freshness to `wave92-bag-v14` so existing bag rows are reparsed under the stricter catalog rule.

## Deferred

- No dedicated Longchamp size-code parser beyond existing small/medium/large/numeric tokens.
- If enough clean Le Pliage rows remain, add Korean shorthand handling for short-handle / long-handle / size codes in a later wave.
