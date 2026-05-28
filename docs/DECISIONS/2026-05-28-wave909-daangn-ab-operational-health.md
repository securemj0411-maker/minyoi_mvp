# 2026-05-28 Wave 909 — Daangn A/B worker operational health check

## Context
- Goal: confirm whether Daangn A/B ingestion is running after shard split, whether manner temperature is being stored, and whether increased Daangn volume is creating downstream bottlenecks.
- Scope: observation only. No runtime code or database schema changes were made in this wave.

## Findings
- Daangn ingestion is healthy.
  - A worker latest sampled run: `20:38:07 KST`, succeeded in `15s`, shard `0/2`, `141` regions, `261` combos, `1,135` catalog-hint/upsert candidates, blocked `0`, failed `0`.
  - B worker latest sampled run: `20:41:42 KST`, succeeded in `24s`, shard `1/2`, `126` regions, `366` combos, `813` catalog-hint/upsert candidates, blocked `0`, failed `0`.
  - B project lock behavior remains expected: the B project should expose only its cron route and return not found for normal frontend paths.
- Daangn manner temperature is being stored.
  - Recent rows include non-null temperatures/review counts such as `아디다스 SL 72 RS` temp `38.7`, `마뗑킴 니트 집업` temp `51.8`, `프라다 비텔로 화이트 모터백` temp `69.4`.
  - Exact 24h count query showed `374` Daangn rows with non-null manner temperature and `11,321` rows with `detail_status='done'`.
  - Interpretation: the field works, but coverage is still limited by detail fetch capacity and prior search-only rows that were marked done.
- Current Daangn pool state from exact joined count:
  - `ready`: `467`
  - `invalidated`: `416`
  - `spent`: `6`
  - `reserved`: `1`
- Main bottleneck is not Daangn fetching.
  - `score-worker`: 3h sample `111` collect runs, avg `55s`, max `79s`, currently showing running/cooldown pressure. Recent Daangn score-dirty count in 3h was about `1,042`; all-source score-dirty exact/planned count was very high (`83,377`), so ready conversion can lag after ingestion increases.
  - `lifecycle-worker`: latest samples repeatedly fail on `claim_mvp_terminal_lifecycle_rechecks` with Supabase statement timeout. This affects terminal/sold cleanup rather than Daangn fetch itself.
  - Some operational count queries against `mvp_raw_listings` time out when ordered or counted on heavy predicates, so admin diagnostics should prefer indexed windows or a materialized rollup.

## Decision
- Treat the A/B Daangn worker split as operationally working.
- Do not add more Daangn intake until the downstream path is improved; otherwise more raw rows will mostly increase score/lifecycle backlog.

## Next Work
- Split or prioritize `score-worker` for Daangn rows so increased ingestion converts to ready pool faster.
- Fix `claim_mvp_terminal_lifecycle_rechecks` with a smaller batch/index-aware query or separate terminal recheck worker.
- Improve manner temperature coverage by raising detail fetch capacity only after score/lifecycle pressure is reduced.
- Add a lightweight indexed operational rollup for Daangn seen/detail/temp/ready counts to avoid live dashboard timeout queries.
