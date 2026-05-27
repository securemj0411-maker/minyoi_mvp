# Wave 795 — Daangn firehose CPU sieve / repeated-row skip

- Date: 2026-05-27 KST
- Trigger: owner asked to keep going on the Daangn nationwide firehose optimization.

## Decision

Keep the broad Daangn firehose strategy, but reduce repeated CPU work before DB writes.

The direction remains:
- Fetch nationwide region feed broadly.
- Drop irrelevant categories before DB.
- Use catalog hints before expensive classifier/parser.
- Skip unchanged rows before classifier/parser when they are inside the same 2h no-op window as the raw RPC.

## Changes

### 1. Catalog hint index

Before:
- For every target-category article, looped through the full scoped catalog hint array and ran `text.includes(hint)`.

After:
- Build per-Daangn-category hint buckets keyed by the first two non-space normalized chars.
- For each article text, build two-char keys and only check likely hint buckets.
- Final decision still uses exact `text.includes(hint)`, so the sieve remains conservative.

### 2. Timing instrumentation

Added timing fields:
- `categoryFilter`
- `catalogHint`
- `upsertPreselect`

This lets production logs show whether CPU moved from DB/RPC into app-side filtering.

### 3. Repeated null-SKU skip

Before:
- `sku_id IS NULL` rows were always reclassified, because a later catalog/parser patch could make them valid.

After:
- Unchanged null-SKU rows are skipped for the same 2h window as classified rows.
- Trade-off: a catalog/parser patch can take up to 2h to naturally re-evaluate repeated null rows.
- If immediate re-evaluation is needed after a catalog wave, run a scoped rematch/replay rather than making every cron tick pay the cost.

## Local Verification

Command:

```bash
DAANGN_SOURCE_MODE=active npx tsx -e "runDaangnIngest({ maxCombos: 30, maxDetailSamples: 0, maxUpsertArticles: 500, searchConcurrency: 30, delayMs: 200, dryRun: false })"
```

Observed after this wave:
- `articles=5470`
- `filteredArticles=3309`
- `catalogHintArticles=277`
- `rawUpserted=81`
- `rawSkippedExisting=196`
- `catalogHint=260ms`
- `preflightSkipped=196`
- `rawRpc=308ms`
- `parsedUpsert=91ms`
- `rawUpsert=3891ms`
- `total=4918ms`

Previous same-shape local run in this session:
- `rawUpsert=7620ms`
- `total=8474ms`

Full nationwide dry-run (`maxCombos=267`, `dryRun=true`):
- `articles=42896`
- `filteredArticles=26149`
- `catalogHintArticles=2330`
- `upsertCandidateArticles=500`
- `articlesDeferredByUpsertCap=1830`
- `categoryFilter=4ms`
- `catalogHint=1584ms`
- `rawUpsert=1598ms` (dry-run; no DB/classifier upsert)
- `total=4349ms`

## Production Observation

First production `daangn-worker` run after deploy:

- `started_at=2026-05-27T08:13:25Z`
- `duration_ms=15589`
- `collected_count=43367`
- `upserted_count=64`
- `rawSkippedExisting=436`
- `catalogHintArticles=2293`
- `upsertCandidateArticles=500`
- `categoryFilter=8ms`
- `catalogHint=1901ms`
- `preflight=683ms`
- `preflightSkipped=436`
- `rawRpc=205ms`
- `parsedUpsert=108ms`
- `rawUpsert=7538ms`
- `total=15522ms`

Previous production run just before deploy:

- `started_at=2026-05-27T08:08:40Z`
- `duration_ms=35259`
- `rawSkippedExisting=483`
- `preflightSkipped=233`
- `rawUpsert=26454ms`
- `total=35200ms`

Result:
- Total worker time: `35.2s → 15.5s`
- Raw upsert/classifier section: `26.5s → 7.5s`
- Preflight skip moved much closer to the RPC no-op count: `233 → 436`

## Trade-off / Follow-up

- `sku_id IS NULL` repeated rows no longer reclassify every tick. This is intentional.
- For large catalog/parser patches, pair deploy with a scoped rematch if immediate pool recovery matters.
- Next optimization candidate: adaptive region rotation / yield stats, but that is a larger behavior wave and should be separated from this CPU sieve.
