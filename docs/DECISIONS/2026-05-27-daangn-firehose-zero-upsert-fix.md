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
