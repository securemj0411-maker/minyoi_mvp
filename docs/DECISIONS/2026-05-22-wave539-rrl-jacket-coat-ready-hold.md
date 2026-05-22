# 2026-05-22 Wave 539 — RRL jacket/coat ready hold

## Context

- Recent public ready fashion sample audit showed two `clothing-polo-rrl-jacket-coat` rows:
  - `RRL 더블알엘 레이튼 자켓 m`
  - `더블알엘 스트라이프 트윌 유틸리티 재킷 XL RRL`
- The lane readiness note itself recorded a very wide distribution: p25/p75 `82만/264만`.
- That means cheaper utility/work jackets can compare against much higher RRL coat/jacket variants and create inflated expected profit.

## Decision

- Move `polo_rrl_jacket_coat` from public `ready` to `blocked`.
- Keep narrower RRL lanes such as denim jacket, leather/suede jacket, Grizzly jacket, and Browns Beach jacket eligible according to their existing lane status.

## Deferred

- Do not add a generic RRL jacket model parser in this wave.
- Re-open only after repeated exact model names have enough clean samples to split into explicit lanes.

## Production Follow-Up

- Narrowly invalidated existing ready pool rows `pid=408286790` and `pid=409376084`.
- Reason: `wave539_rrl_jacket_coat_ready_hold`.
