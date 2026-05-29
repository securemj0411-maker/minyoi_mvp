# 2026-05-30 Wave 951 — Post-Deploy Pool Propagation Check

## Context

Wave 949 (`2ed31044`) fixed fashion catalog route/readiness gaps:

- NB x Auralee shoe titles now route to `shoe-newbalance-auralee-collab`.
- Arc'teryx Alpha SV/AR/LT exact lanes are now `ready` in `LANE_READINESS`.

After push, `main` advanced to `7a5e00d7` with the separate cron cooldown jitter fix. Vercel production deployment for the latest `main` was `Ready` and aliased to `minyoi-mvp.vercel.app`.

## Production DB Check

Narrow, indexed checks were used. A broad `name ilike` scan was avoided after it hit a statement timeout.

Checked SKUs:

- `shoe-newbalance-auralee-collab`
- `clothing-arcteryx-alpha-sv`
- `clothing-arcteryx-alpha-ar`
- `clothing-arcteryx-alpha-lt`

Observed raw/parsed state:

- Alpha SV/AR/LT rows are already parsed to exact comparable keys such as `clothing|arcteryx_alpha_sv|jacket|a_grade`.
- NB x Auralee rows are already parsed to `shoe|newbalance_auralee_collab|sneaker|...`.
- Alpha exact lanes mostly have no `mvp_candidate_pool` row yet.
- NB x Auralee has some ready/invalidated pool rows, but many rows are still `no_pool`.

Raw propagation snapshot:

- `clothing-arcteryx-alpha-sv`: 17 rows, 16 active/detail done/pool eligible; 6 still `score_dirty=true`.
- `clothing-arcteryx-alpha-ar`: 2 rows, 2 active/detail done/pool eligible; 1 still `score_dirty=true`.
- `clothing-arcteryx-alpha-lt`: 2 rows, 2 active/detail done/pool eligible; 0 dirty at check time.
- `shoe-newbalance-auralee-collab`: 51 rows, 51 active, 50 detail done, 48 pool eligible; 16 still `score_dirty=true`.

Market snapshot:

- Alpha SV has market rows, but latest sampled confidence is mostly low and sparse.
- NB x Auralee has more market rows, including one medium-confidence A-grade mint row, but many condition buckets remain low-confidence.

## Decision

Do not treat this as a deploy failure. Runtime parsing/readiness is live. The remaining gap is score/market/pool propagation:

- Let the normal score worker process currently dirty rows.
- If production pool does not move after a few score/pool cycles, inspect exact skip reasons before applying any write-side recovery.
- Avoid broad unindexed production scans for this check path.

## Deferred

- No manual broad reparse was run in this wave.
- No forced production score-worker call was run from the agent, because it can trigger wider scoring/AI/cache work beyond this narrow verification.
- If owner wants faster propagation, create a scoped requeue plan for the exact SKUs above and cap it explicitly.

