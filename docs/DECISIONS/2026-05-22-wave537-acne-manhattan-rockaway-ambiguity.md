# 2026-05-22 Wave 537 — Acne Manhattan / Rockaway ambiguity

## Context

- Post-deploy v17 shoe sample audit showed titles containing both `맨하탄/Manhattan` and `락어웨이/Rockaway`.
- These rows were entering the Manhattan comparable bucket even though the title is model-ambiguous and likely search-stuffed.

## Decision

- Add `락어웨이` / `락 어웨이` / `rockaway` to the Acne Manhattan SKU blocklist.
- Update the regression test so `아크네스튜디오 맨하탄 락어웨이` resolves to no SKU instead of Manhattan.
- Bump shoe parser freshness from `wave92-shoe-v17` to `wave92-shoe-v18` so existing ambiguous v17 parsed rows are forced through the stricter rule.

## Deferred

- No dedicated mixed Manhattan/Rockaway lane.
- If a later manual audit proves a repeatable official sub-line exists, add a reviewed lane; until then, hold mixed titles out of ready samples.
