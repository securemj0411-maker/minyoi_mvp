# 2026-05-29 — Wave 913 Daangn Sangdo Region Precision

## Decision

- Verified B/C worker production runtime from `mvp_collect_runs`:
  - B is running `/api/cron/daangn-worker-b` with `regionShardCount=2`, `regionShardIndex=1`, `maxUpsertArticles=800`, `searchConcurrency=50`.
  - B score worker is running Daangn shard `1/2`.
  - C is running `/api/cron/daangn-worker-c` with `categoryTargetOnly=true`, `categoryTargetRegions=30`, `maxUpsertArticles=700`, `searchConcurrency=35`.
- Added Daangn exact dong seeds for Dongjak-gu:
  - `6088` 노량진동
  - `6089` 동작동
  - `6090` 본동
  - `6091` 사당동
  - `6092` 상도1동
  - `6093` 상도동
  - `6094` 신대방동
- Added matching parent paths and static geo centroids so home-region matching and distance ranking resolve Sangdo exactly instead of falling back to the Dongjak-gu centroid.

## Why

- User report: home region is 상도1동, but nearby Daangn feed repeatedly surfaced 사당동 and no 상도동.
- Production data check:
  - Daangn ready pool had 사당동 ready rows, but no 상도/상도1동 ready rows.
  - `daangn-region-parents.json` and `daangn-region-geo.json` only had `동작구` seed and `사당동` among Dongjak locations.
  - `DEFAULT_DAANGN_REGION_SEEDS` only had `동작구`, so ingestion was gu-level for Dongjak and could under-cover Sangdo exact dong listings.
- Direct probe confirmed Daangn web search works for:
  - `상도1동-6092`
  - `상도동-6093`
  - `사당동-6091`

## Verification

- `npx tsx --test tests/home-region-matcher.test.ts tests/daangn-region-distance.test.ts tests/daangn-ingest.test.ts` => pass
- `npm run build` => pass
- `npx tsc --noEmit --pretty false` still fails on existing old test type debt unrelated to this change.

## Deferred

- Broader Seoul dong seed expansion. This wave only patches the reported Dongjak/Sangdo local precision gap.
- Persisting the user's raw GPS lat/lng in `mvp_user_home_regions`. Exact Daangn dong centroids are enough for this issue; user-specific coordinate storage needs a separate schema wave.
