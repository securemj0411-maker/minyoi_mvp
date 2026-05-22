# 2026-05-22 Wave 536 — Dr. Martens Flora / 2976 split

## Context

- Post-deploy ready sample audit found `닥터마틴 플로라 첼시` entering `shoe-drmartens-2976-chelsea`.
- Flora is a separate women's Chelsea line and should not share 2976 Chelsea market samples.

## Decision

- Add `플로라` / `flora` to the 2976 Chelsea catalog blocklist.
- Add a regression test that Flora Chelsea rows do not match `shoe-drmartens-2976-chelsea`.
- Bump shoe parser freshness from `wave92-shoe-v16` to `wave92-shoe-v17` so existing parsed 2976 rows are forced through the new catalog blocklist.

## Deferred

- A dedicated Flora lane is not added yet.
- If Flora has enough repeatable sample volume later, split it into a ready or hold-reviewed narrow lane.
