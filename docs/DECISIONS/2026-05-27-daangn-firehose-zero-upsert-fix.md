# 2026-05-27 — Daangn firehose zero-upsert hotfix

## Context

운영 DB 확인 결과 최근 `daangn-worker` 는 267개 region 에서 4만 건 안팎을 정상 fetch 했지만, Wave 778 raw category filter 후 `upserted_count=0` 으로 성공 처리되고 있었다.

원인은 Daangn firehose 응답의 article `category` payload 가 `dbId/name` 없이 `thumbnail` 만 제공되는 형태였기 때문이다. 기존 filter 는 `article.category.dbId` 가 없으면 모두 drop 했다.

## Decision

- `src/lib/daangn.ts` 에 Daangn category thumbnail digest → category id/name 복원 map 을 추가했다.
- category filter 페이지처럼 `currentFilters.categoryId` 가 있는 경우 article category 가 sparse 여도 해당 category id/name 으로 fallback 한다.
- category filter 후에도 target category가 너무 커서, DB write 전 catalog search-query hint 로 한 번 더 cheap sieve 를 건다.
- 267 region 전국 fetch 는 유지하되, DB write 후보는 최신순으로 `DAANGN_INGEST_MAX_UPSERT_ARTICLES` cap 을 적용한다. 기본값은 500이다.
- search fetch 는 267개 동시 `Promise.all` 대신 `DAANGN_INGEST_SEARCH_CONCURRENCY` 제한을 적용한다. 기본값은 50이다.
- `DAANGN_INGEST_MAX_COMBOS` 등 env fallback 이 실제 cron options 로 들어가게 수정했다.

## Verification

- DB observation before fix:
  - latest `daangn-worker`: `collected_count=41479`, `upserted_count=0`, `mode=active`, health=`healthy`
  - inferred root cause: category filter zero keep
- Live dry-run after category thumbnail restore:
  - `articles=37881`
  - `filteredArticles=23349`
  - `missingCategory=0`
- Live dry-run after catalog hint + cap:
  - `articles=36804`
  - `filteredArticles=22796`
  - `catalogHintArticles=2156`
  - `upsertCandidateArticles=500`
  - `sourceHealth=healthy/ok`
- Small production write rehearsal:
  - 5 combos: `rawUpserted=31`, health=`healthy`, `rawUpsert=7172ms`
  - 50 combos before upsert cap: `rawUpserted=509`, `rawUpsert=75030ms` → full 267 uncapped would likely exceed worker budget
- Tests:
  - `npx tsx --test tests/daangn-source-probe.test.ts tests/daangn-ingest.test.ts` passed
  - `npm run build` passed
- Production after deploy:
  - deployment: `minyoi-1082brwl1-securemj0411-7703s-projects.vercel.app`
  - run: `2026-05-27T05:58:50Z`
  - `collected=29512`, `filteredArticles=18817`, `catalogHintArticles=1743`
  - `upsertCandidateArticles=500`, `upserted=498`
  - `searchConcurrency=50`, `durationMs=109700`, `rawUpsert=100654ms`
  - health=`healthy`, reason=`ok`

## Deferred

- Full 267 production write rehearsal was not completed because repeated local 267 fetches triggered Daangn `403` on the local IP. This does not prove Vercel IP is blocked, but it validates adding search concurrency.
- Upsert cap may defer some catalog-hint articles each run. If ready inflow is still lower than desired after deploy, next step is either RPC bulk-upsert optimization or sharded Daangn workers by region bucket.
- Catalog hint filtering is intentionally conservative for DB safety. Future catalog expansion should add aliases/searchQueries so Daangn prefilter keeps the new lane.

## Follow-up — score-worker timeout after Daangn raw growth

### Context

After Daangn raw ingest recovered, `score-worker` started failing intermittently on `mvp_raw_listings` reads:

- `canceling statement due to statement timeout`
- failing path: score dirty rows ordered by `last_seen_at desc`

Root cause was not Daangn fetching. The score loader fetched broad `score_dirty=true` rows first, then discarded non-scorable rows in JS. With Daangn firehose rows in the raw table, that scan became too expensive.

### Decision

- Push cheap scorable predicates into the DB query:
  - `score_dirty=true`
  - `detail_status=done`
  - `sku_id is not null`
  - `listing_state=active`
- Add partial indexes for the score hot path:
  - recent dirty scorable rows
  - source-scoped dirty scorable rows
  - SKU-prefix dirty scorable rows
- Add two support indexes for score-stage side loaders:
  - active fashion `first_seen_at` for low-volume SKU guard
  - active `description_hash/seller_uid` for fraud-group hash RPC
- Clamp `loadFraudGroupHashes` timeout to at least 8s. After indexing, the RPC was healthy but still slower than the old 1.5s local timeout.

### Production Application

Supabase CLI `db push --dry-run` could not be used safely because remote migration history contains many versions missing from local migration files. Instead, the five indexes were applied directly to production using `CREATE INDEX CONCURRENTLY IF NOT EXISTS`.

Applied production indexes:

- `mvp_raw_listings_dirty_scorable_recent_idx`
- `mvp_raw_listings_dirty_scorable_source_recent_idx`
- `mvp_raw_listings_dirty_scorable_sku_recent_idx`
- `mvp_raw_listings_active_fashion_first_seen_idx`
- `mvp_raw_listings_active_description_seller_idx`

### Verification

- Before score hot-path fix:
  - score-worker failed with raw-listing statement timeout.
- After indexes + query filter:
  - Daangn scorable REST query: `324ms`
  - General scorable REST query: `713ms`
  - Fashion scorable REST query: `2464ms`
  - Low-volume SKU REST query: `323ms`
  - Fraud-group RPC: `5502ms`
- Local production-backed score-stage rehearsal:
  - `npx tsx scripts/run-score-stage-once.ts --limit=50 --budget-ms=90000`
  - First run after score hot-path fix: `scored=50`, `poolUpserted=3`, `timedOut=false`
  - Second run after side-loader indexes/timeout clamp: `scored=50`, `timedOut=false`, no side-loader timeout logs

### Deferred

- Raw upsert remains the largest Daangn-worker cost (`~100s` for 498 rows in the verified production run). If Daangn supply should exceed the current 500/write cap, optimize the raw upsert RPC or shard Daangn workers by region bucket before raising the cap.
- Fraud-group RPC is now functional but still several seconds. If it grows again, replace the per-run aggregate with a materialized/cache table updated by housekeeper.

## Follow-up — raw upsert no-op skip

### Context

After score-worker stabilization, the remaining Daangn bottleneck was `daangn-worker` raw write time:

- verified production run before fix: `rawUpsert=100654ms` for `~498` rows
- function was already set-based, but conflict rows were updated every run
- because Daangn firehose repeatedly sees the same boosted rows, this re-wrote `last_seen_at`, `updated_at`, `raw_json`, and `score_dirty` even when title/price/SKU/state did not change
- side effect: already-scored rows could be requeued as `score_dirty=true` from a pure search touch

### Decision

- Replace `daangn_bulk_upsert_raw_listings(jsonb)` with a no-op-skip conflict policy:
  - insert new rows normally
  - update existing rows only if meaningful listing/scoring fields changed
  - allow a coarse active touch only when existing `last_seen_at` is older than 2h
  - preserve `score_dirty` for pure seen-again touches
  - set `score_dirty=true` only when meaningful fields changed and the new row is pool eligible
- Replace `daangn_bulk_upsert_listing_parsed(jsonb)` so parsed rows also skip no-op conflict updates.
- Update `upsertDaangnRawListings()` to read the RPC affected-row count and report `rawSkippedExisting`.
- Add missing Daangn/raw runtime columns to migration/schema snapshots so the RPC definition is reproducible.

### Production Application

Supabase CLI migration push is still unsafe because remote migration history contains many versions missing locally, so the function replacement was applied directly to production with the same SQL that was committed as a migration.

### Verification

- Production RPC repeat-payload test:
  - input: `500` latest Daangn rows with fresh `last_seen_at`
  - result: `affected=0`, `skipped=500`
  - duration: `417ms`
- Local small active ingest against production DB:
  - `maxCombos=5`, `maxUpsertArticles=50`
  - `articles=272`, `catalogHint=13`, `upsertCandidate=13`
  - `rawUpserted=13`, `rawSkippedExisting=0`
  - `rawUpsert=1737ms`, health=`healthy/ok`
- Tests:
  - `npx tsx --test tests/daangn-source-probe.test.ts tests/daangn-ingest.test.ts` passed
  - `npm run build` passed

### Deferred

- Need observe the next full production `daangn-worker` run after app deploy. Expected result: much lower `rawUpsert` when candidates are mostly already-seen rows, plus meaningful `rawSkippedExisting` in stage stats.
- If rawUpsert is still high for genuinely new rows, the next lever is sharding Daangn workers by region bucket or raising `DAANGN_INGEST_MAX_UPSERT_ARTICLES` gradually while watching DB write duration.

## Follow-up — parsed-only-on-changed-pids and scoped Daangn classification

### Context

The first production run after the raw no-op skip confirmed that the raw DB function was working, but total `rawUpsert` stayed high:

- `2026-05-27 07:08 UTC` production `daangn-worker`
  - `upsertCandidateArticles=500`
  - `upserted_count=12`
  - `rawSkippedExisting=488`
  - `rawUpsert=100453ms`

This proved raw rows were mostly skipped, but the app still sent all candidate parsed rows after the raw call. A local timing split then showed the DB calls themselves were no longer the bottleneck:

- local active sample (`maxCombos=30`, `upsertCandidate=314`)
  - `rawRpc=654ms`
  - `parsedUpsert=149ms`
  - `rawUpsert=47640ms`

The remaining time was the in-process `classifyListing` / parser preparation before the DB RPC.

### Decision

- Add `daangn_bulk_upsert_raw_listings_v2(jsonb)` returning:
  - `affected`
  - `affectedPids`
- Keep the v1 integer RPC intact so already-deployed code remains safe during rollout.
- Change Daangn ingest to:
  - call v2
  - send parsed rows only for pids actually inserted/updated by raw
  - record `rawRpc` and `parsedUpsert` timing inside `timingsMs`
- Deduplicate Daangn candidate articles by external id before the expensive classifier/parser path.
- Reuse `classifyListing()`'s returned SKU instead of calling `ruleMatch()` a second time.
- Add a scoped catalog matching path (`ruleMatchWithinCategories`) and pass Daangn source category-derived SKU categories into `classifyListing()` so the matcher scans fewer impossible SKU lanes.

### Production Application

`daangn_bulk_upsert_raw_listings_v2(jsonb)` was applied directly to production with the committed migration SQL. The old RPC remains available.

### Verification

- v2 function exists in production and returns `jsonb`.
- Local active samples after app changes:
  - before scoped classifier: `upsertCandidate=314`, `rawUpsert=47640ms`, `rawRpc=654ms`, `parsedUpsert=149ms`
  - after dedupe/scoped classifier: `upsertCandidate=272`, `rawUpsert=20924ms`, `rawRpc=490ms`, `parsedUpsert=129ms`
- Tests/build:
  - `npx tsx --test tests/daangn-source-probe.test.ts tests/daangn-ingest.test.ts` passed
  - `npm run build` passed

### Deferred

- Observe the next full production `daangn-worker` after deploy. Expected full-run `rawUpsert` should move from `~100s` toward the `~20-45s` range depending on candidate count.
- `tests/core-rules.test.ts` currently has two existing expectation mismatches in broad classifier behavior (`applewatch-se2-44mm` vs `applewatch-se2`, PS5 digital comparable broad vs exact). They are not on the Daangn ingest surface verified here, but should be handled in a separate catalog/parser correctness pass before using core-rules as a release gate again.

## Follow-up — preflight skip before expensive classification

### Context

After v2 raw RPC rollout, production confirmed the app was using the new timing fields:

- `2026-05-27 07:38 UTC` production `daangn-worker`
  - `upsertCandidateArticles=500`
  - `upserted_count=20`
  - `rawSkippedExisting=480`
  - `rawRpc=508ms`
  - `parsedUpsert=90ms`
  - `rawUpsert=42812ms`

The database path was no longer the bottleneck. The remaining `rawUpsert` time was mostly CPU spent classifying/parsing rows that the DB later skipped.

### Decision

- Add a Daangn preflight stage before classifier/parser:
  - dedupe by external id
  - compute cheap pid/listing fields
  - fetch existing `mvp_raw_listings` rows by pid with service-role REST headers
  - skip expensive classification if:
    - row already has `sku_id`
    - `last_seen_at` is within the 2h coarse touch window
    - cheap listing fields, source timestamp, region, shipping inference, and raw JSON identity are unchanged
- Keep `sku_id IS NULL` rows eligible for reclassification so catalog/parser improvements can still rescue old unknown rows.
- Add `preflight` and `preflightSkipped` timings to `timingsMs`.

### Verification

- Daangn ingest tests passed:
  - `npx tsx --test tests/daangn-source-probe.test.ts tests/daangn-ingest.test.ts`
- Local production-backed active sample:
  - `articles=5988`
  - `catalogHint=324`
  - `upsertCandidate=324`
  - `rawUpserted=200`
  - `rawSkippedExisting=124`
  - `preflight=641ms`
  - `preflightSkipped=60`
  - `rawRpc=431ms`
  - `parsedUpsert=167ms`
  - `rawUpsert=13155ms`
  - `total=15795ms`

### Deferred

- Observe the next full production `daangn-worker` after deploy. Expected full-run `rawUpsert` should drop again when repeated candidates are common.
- The remaining work for this Daangn wave is now:
  - faster catalog hint matching (trie/hash)
  - adaptive region/category rotation from observed yield
  - optional worker sharding after yield logs are stable
