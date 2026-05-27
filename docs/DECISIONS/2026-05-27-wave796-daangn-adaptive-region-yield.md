# Wave 796 — Daangn adaptive region yield stats

- Date: 2026-05-27 KST
- Trigger: owner approved the next Daangn firehose optimization wave after Wave 795 reduced repeated classifier CPU.

## Decision

Add low-risk region yield instrumentation now, and make adaptive region rotation available for future fallback runs where `DAANGN_INGEST_MAX_COMBOS` is lower than the full region count.

Current production still fetches all 267 regions, so this wave does not reduce coverage. It prepares the system for a safer fallback mode if Daangn/Vercel/Supabase pressure requires fewer regions per tick.

## Supabase Note

No schema migration in this wave.

Supabase changelog was checked before implementation. Relevant current caution: new tables may not be exposed to Data API automatically, but this wave only writes JSON into the existing `mvp_collect_runs.stage_stats` path via the existing collect logging flow.

## Changes

### 1. Region yield stats in `stage_stats`

Each `daangn-worker` run now records:

- fetched articles per source region
- target-category articles per source region
- catalog-hint articles per source region
- final upsert-candidate articles per source region
- top 20 regions by catalog hint yield
- zero-catalog-hint region count

Important correction:

Daangn article payloads often contain a dong-level `article.region`, while the firehose fetch uses our selected source region seed. Adaptive scoring must key by the source region seed, not the article payload region. This wave keeps a `href -> sourceRegion` map during parsing and builds yield stats from that.

### 2. Adaptive region rotation

`selectDaangnFirehoseCombos()` now supports optional recent `regionScores`.

When `maxRegions < regions.length`:

- exploit: choose high-score regions first
- explore: reserve a small random slice for regions without recent yield

When `maxRegions >= regions.length`, selection mode remains `all_regions`.

Production currently remains `all_regions`.

### 3. Recent score loader

When adaptive mode is needed, `runDaangnIngest()` can load recent region yield stats from the latest successful `mvp_collect_runs` rows for `/api/cron/daangn-worker`.

Score formula:

```text
catalogHint * 10
+ upsertCandidate * 20
+ targetCategory * 0.15
+ fetched * 0.01
```

Recent runs are weighted higher.

## Verification

Unit tests:

```bash
npx tsx --test tests/daangn-source-probe.test.ts tests/daangn-ingest.test.ts
```

Result:

- 24 pass
- 0 fail

Build:

```bash
npm run build
```

Result:

- Passed

30-region dry-run:

- `combos=30`
- `regionSelectionMode=random`
- `adaptiveRegionScoreRegions=0` (no previous region-yield stats yet)
- `articles=4888`
- `filteredArticles=3146`
- `catalogHintArticles=303`
- `upsertCandidateArticles=200`
- `regionRows=30`
- top regions included seed-level ids/names such as `양천구`, `강남구`, `부산 서구`

Full 267-region dry-run:

- `combos=267`
- `regionSelectionMode=all_regions`
- `articles=43334`
- `filteredArticles=26419`
- `catalogHintArticles=2322`
- `upsertCandidateArticles=500`
- `regionRows=267`
- `zeroCatalogHintRegions=108`
- `regionYieldJsonBytes=33329`
- `total=7796ms`

## Trade-off

`regionYieldStats` adds about 33KB per full Daangn run to collect logs. At a 5-minute cadence this is roughly 9-10MB/day. Accepted for now because it avoids a new table and gives immediate learning data.

If this grows annoying, next wave should compact this JSON or move it into a daily aggregate table.

## Follow-up

- After deployment, confirm the next `daangn-worker` run has `regionYieldStats`.
- Once several runs are stored, lower `DAANGN_INGEST_MAX_COMBOS` in a controlled test to verify `regionSelectionMode=adaptive` and `adaptiveRegionScoreRegions > 0`.
- Consider adding an admin view for top/zero-yield Daangn regions if we want operational visibility.

## Production Observation

Manual Vercel production deploy was required because GitHub CI is currently failing on older unrelated test fixture type errors (`wave141`, `wave145`, `wave148`, etc.). Remote Vercel build itself passed and was aliased to production.

First observed production `daangn-worker` run after deploy:

- `started_at=2026-05-27T08:33:02Z`
- `duration_ms=24804`
- `collected_count=34757`
- `upserted_count=194`
- `regionSelectionMode=all_regions`
- `adaptiveRegionScoreRegions=0` (expected: no previous region-yield stats existed yet)
- `regionRows=267`
- `zeroCatalogHintRegions=139`
- `catalogHintArticles=1976`
- `upsertCandidateArticles=500`
- `sourceHealthStatus=healthy`

Top region-yield examples:

| region | fetched | targetCategory | catalogHint | upsertCandidate |
|---|---:|---:|---:|---:|
| 용산구 | 269 | 226 | 40 | 25 |
| 금천구 | 274 | 191 | 39 | 0 |
| 부산 동구 | 267 | 200 | 37 | 15 |
| 양천구 | 249 | 166 | 34 | 17 |
| 강남구 | 263 | 221 | 33 | 33 |

Important: region keys are now source seed ids/names, not dong-level article payload regions. This confirms the earlier dry-run correction is working in production.
