# Wave 1015 — Score-worker RPC filter hotpath

Date: 2026-06-02

## Context

After Wave 1014 fixed stale-marker alert noise, the next bottleneck check focused on real runtime and DB cost.

Recent collect-run and DB hotpath reports showed:

- effective worker failures were near zero after stale-marker filtering
- `score` stage was the largest accumulated function-time proxy
- recent `score-worker` runs spent about `95s-105s` while producing `0` scored/pool rows
- a sample run showed:
  - `score_load_rows`: `96,034ms`
  - `score_rows_loaded`: `100`
  - `timedOut`: `true`
  - `scored`: `0`

## Finding

`loadScorableRows()` used the `claim_scorable_raw_rows` RPC, but the RPC path ignored the `extraFilter` passed by source reserve lanes.

That meant these calls could all repeat broad dirty scans instead of scoped scans:

- Daangn reserve: `&source=eq.daangn`
- Joongna reserve: `&source=eq.joongna`
- Bunjang general: `&source=eq.bunjang`

The older REST fallback path did apply `extraFilter`, but the RPC path did not. On top of that, the RPC request used a broad `scanLimit` up to `1000` even when the score worker only needed `100` rows.

Result: score workers could spend most of their 55s intended budget loading rows, then return `timedOut=true` with no useful scoring work.

## Change

- Added `scorableRpcSourceFilterForExtraFilter()`.
  - Supported source filters are converted into RPC `p_source_filter`.
  - Unsupported filters such as fashion `sku_id.like...` return `undefined`, forcing the existing REST fallback so the filter is not silently ignored.
- Added `scorableRpcLimitForRequest()`.
  - Current `tickScoreLimit=100` now requests a 300-row RPC buffer instead of 1000.
  - Larger explicit limits are not capped below the requested limit.
- Made `claim_scorable_raw_rows` opt-in via `PIPELINE_SCORE_CLAIM_RPC_ENABLED=1`.
  - Default production path returns to the indexed REST GET fallback.
  - The RPC code remains available for a future SQL-plan repair, but is not used by default.
- Added regression tests for both contracts.

## Follow-up Production Measurement

The first code-only deploy still showed no improvement:

- `18:39 KST score_worker`: `score_load_rows=104.8s`, `scored=0`, `timedOut=true`
- `18:39 KST score_worker_b`: `score_load_rows=90.9s`, `scored=0`, `timedOut=true`
- `18:39 KST score_worker_c`: `score_load_rows=93.2s`, `scored=0`, `timedOut=true`

Direct non-mutating production calls then isolated the root cause:

- RPC `claim_scorable_raw_rows(p_limit=10, p_source_filter='daangn', shard=0/3)`
  - failed after `60.2s`
  - error: `57014 canceling statement due to statement timeout`
- equivalent REST GET, source-scoped:
  - Daangn limit 100, small columns: `153ms`
  - Bunjang limit 100, small columns: `184ms`
  - Joongna limit 100, small columns: `58ms`
- equivalent REST GET, full score columns:
  - Daangn limit 100: `297ms`
  - Bunjang limit 100: `525ms`
  - Joongna limit 100: `268ms`

Conclusion: the raw table/indexes are not the immediate problem. The SQL RPC plan is the immediate bottleneck, likely because the generic OR/modulo shard conditions prevent the intended source/dirty/recent index path.

## Verification

- `npx tsx --test --test-name-pattern "score RPC" tests/core-rules.test.ts`
  - `2 pass, 0 fail`
- `npx tsx --test tests/market-invalidation-priority-contract.test.ts`
  - verifies the score claim RPC remains opt-in by default
- `npm run build`
  - passed

## Existing Unrelated Findings

- Full `tests/core-rules.test.ts` still has an unrelated AirPods 4 catalog regression:
  - `AirPods 4 no-ANC wording does not enter ANC catalog lane`
- `npx tsc --noEmit` is not a clean repo-wide verifier right now because several existing test fixtures have type errors unrelated to this patch.
- Build still surfaces the known landing showcase sold-listing query timeout:
  - `mvp_raw_listings ... listing_state=eq.sold_confirmed ... order=sold_detected_at.desc ... 57014`
  - This remains a separate DB hotpath follow-up.

## Deferred

- Repair or replace `claim_scorable_raw_rows` SQL separately:
  - avoid generic OR conditions
  - avoid modulo shard predicates on the ordered scan path, or split into source/shard-specific functions/indexes
  - validate with EXPLAIN before re-enabling `PIPELINE_SCORE_CLAIM_RPC_ENABLED`
- Landing showcase sold-listing query should be fixed separately with an index/RPC/cache strategy.

## Production Verification

After deploying the opt-in RPC patch to primary and B:

- `19:03 KST /api/cron/score-worker`
  - host: `minyoi-g2dygr03b...`
  - duration: `15.4s`
  - `score_load_rows=1.8s`
  - `scored=96`
  - `timedOut=false`
- `19:03 KST /api/cron/score-worker-b`
  - host: `minyoi-mvp-atff-l0j321qe8...`
  - duration: `1.3s`
  - `score_load_rows=0.3s`
  - `scored=50`
  - `timedOut=false`

The C shard initially stayed slow because the separate `minyoi-mvp-daangn-c`
Vercel project had not deployed the new commit:

- project list showed `minyoi-mvp-daangn-c` last updated `5h` ago while
  primary/B were current.
- old C host `minyoi-mvp-daangn-ecvdqthcy...` kept producing
  `~98s`, `scored=0`, `timedOut=true`.

Redeployed C from a clean `HEAD` worktree to avoid uploading unrelated local
dirty files:

- deployment: `minyoi-mvp-daangn-20olxy0q6...`
- forced verification run:
  - run id: `36f75a99-7052-4025-9d7c-1ccef57827c4`
  - duration: `33.3s`
  - `score_load_rows=852ms`
  - `scored=100`
  - `poolUpserted=3`
  - `timedOut=false`

Conclusion: the score row-load bottleneck is fixed in A/B/C. This was not an
alert mute; the verification was based on collect-run stage timings and scored
row counts.

## New Follow-up

The C verification surfaced a smaller post-load cost:

- `score_clear_score_dirty=20.2s`

This is not currently causing timeouts, but it is the next score-stage
optimization candidate after the row-load fix. Likely direction: make the dirty
clear patch smaller/chunked or source/shard-aware before raising throughput.
