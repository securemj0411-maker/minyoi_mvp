# 2026-05-29 Wave 938 — Daangn B ingest tuning and ops review

## Context

After A/B/C Daangn ingest, detail, and score sharding, the user asked to review the remaining bottlenecks broadly rather than just keep adding servers.

This wave reviewed:

- Daangn A/B/C ingest efficiency
- detail worker throughput
- score worker failures after the 3-shard split
- ready pool quality, especially high ROI and missing Daangn trust signals

## Findings

### B ingest was doing duplicate-heavy work

Latest production runs before tuning:

| worker | executed combos | category boost regions | category boost combos | typical duration |
| --- | ---: | ---: | ---: | ---: |
| A `/api/cron/daangn-worker` | 387 | 15 | 120 | about 36s |
| B `/api/cron/daangn-worker-b` | 507 | 30 | 240 | about 70s |
| C `/api/cron/daangn-worker-c` | 240 | 15 | 240 | about 41s |

C is already the category-target worker. B running 30 boosted regions meant B duplicated too much of the category-depth work while still also doing broad firehose coverage.

### Ready growth is alive

Snapshot after the review:

- total ready: about `3,495`
- Daangn raw last_seen in last 1h: about `18,018`
- Daangn raw last_seen in last 6h: about `60,983`
- ready added in last 1h: `175`, all Daangn
- ready added in last 6h: `761`, all Daangn

Interpretation: Daangn is not stalled. The visible pool can still look flat at moments because lifecycle/spent invalidation and rescoring remove rows while new rows enter, but ingress and ready promotion are both active.

### Ready quality check

Full ready snapshot:

| source | ready | ROI >= 40% | ROI >= 50% | ROI >= 60% |
| --- | ---: | ---: | ---: | ---: |
| Daangn | 2,654 | 59 | 0 | 0 |
| Bunjang | 766 | 125 | 64 | 17 |
| Joongna | 65 | 8 | 4 | 2 |

Daangn high-ROI outliers are not currently blowing past the guardrails. Most Daangn `>=40%` cases are clothing/shoe and none were `>=50%`.

Temporary observation: a query briefly saw five Daangn ready rows with `daangn_manner_temperature = null`, but the next score cycle had already removed them. No manual DB mutation was applied.

### Score worker

B/C score workers are clean. A score worker still had one recent failure, but it was from the primary raw scoring fetch timing out, not the previously patched dirty-pool refresh helper.

Latest 30 minute shape after Wave 937:

- A score: mostly succeeds, one older raw-listing statement-timeout failure still present in the window
- B score: succeeds
- C score: succeeds

Decision: keep observing after the Wave 937 deploy window. If A failures continue, the next fix should target the primary `score_dirty=true + detail_status=done + active + last_seen_at desc` raw query path, likely with a narrower source reserve/index/RPC rather than raising worker count.

### Detail worker

A/B/C detail shards are all running and not failing.

Recent duration is still high, especially B/C, but this is expected while the Daangn backlog is being enriched. Do not raise detail concurrency blindly because this is the route most likely to trip marketplace blocking.

## Applied change

Changed B project production env:

- `DAANGN_INGEST_B_CATEGORY_BOOST_REGIONS`: `30` -> `15`

Redeployed B project:

- project: `minyoi-mvp-atff`
- deployment: `https://minyoi-mvp-atff-m6mtmhqah-securemj0411-7703s-projects.vercel.app`

Verification:

- forced B run succeeded
- `executedCombos`: `387`
- `categoryBoostRegions`: `15`
- `categoryBoostCombos`: `120`
- `upserted`: `738`
- automatic run after deploy also used `executedCombos=387`, `categoryBoostRegions=15`

Expected effect:

- less duplicate category-depth work between B and C
- lower B runtime and Supabase row-build/upsert pressure
- broad discovery remains active on B; C still owns category-target depth

## Deferred

- Do not switch B to `categoryTargetOnly`; that would remove B's broad discovery role.
- Do not loosen quality gates just to increase count.
- Do not blanket-block fashion ROI over 40%; current fashion/shoe high ROI is expected to be noisier and existing policy intentionally only blocks stronger anomalies or weak-signal rows.
- If A score worker keeps timing out after the current deploy window, investigate a DB-side score candidate RPC or a dedicated partial index for the primary raw scoring query.
- Detail worker dynamic throttling is deferred until the backlog calms down.
