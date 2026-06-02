# Wave 1011 — Daangn source health NOT NULL contract fix

Date: 2026-06-02

## Context

- Wave 1010 added a Daangn `mvp_source_health` writer, but production logs showed the insert was still failing.
- Vercel runtime logs showed:
  - `daangn source health insert failed (non-fatal)`
  - Supabase/PostgREST 400 / `23502`
  - `null value in column "detail_404_rate" of relation "mvp_source_health" violates not-null constraint`
- `mvp_source_health.detail_success_rate`, `detail_404_rate`, and `detail_5xx_rate` are `NOT NULL` with defaults, but the Daangn writer explicitly sent `null` when no detail samples were attempted.

## Decision

- Keep the schema contract intact. Do not relax `NOT NULL`.
- Normalize Daangn scalar source-health rates before insert:
  - `detail_success_rate`: fallback `1`
  - `detail_404_rate`: fallback `0`
  - `detail_5xx_rate`: fallback `0`
- Treat `null`, `undefined`, empty string, and non-finite values as fallback values.
- Add a regression test that runs `runDaangnIngest` with mocked Daangn/Supabase fetches and `maxDetailSamples=0`, then asserts the source-health insert payload has non-null rate fields.

## Why This Is Not A Kludge

- The table already defines these defaults and bounds. The code now matches that existing schema-level contract instead of trying to silence Telegram or skip health writes.
- A run with no detail attempts does not mean 404/5xx happened. The conservative scalar representation is success `1`, 404 `0`, 5xx `0`, while the richer `baseline_json.detailSuccessRate` can still carry null/unknown if needed.

## Deferred

- Daangn lifecycle claim/query bottlenecks are still separate. Recent logs also show `wave978_backfill_daangn_lifecycle_chunk` timeout/lock-timeout and market parsed-row statement timeouts.
- Next structural pass should inspect lifecycle claim indexes/RPC plans before changing schema or worker cadence.

## Verification

- `npx tsx --test tests/daangn-ingest.test.ts`
  - 29 pass, 0 fail
- `npx tsx --test tests/daangn-ingest.test.ts tests/daangn-source-probe.test.ts tests/cron-guard.test.ts tests/lifecycle-state.test.ts`
  - 53 pass, 0 fail
- `npm run build`
  - Passed
  - Existing landing showcase sold-preview query hit a Supabase `57014` statement timeout during revalidation, but the page fallback allowed the build to complete.

## Production Verification

- Commit deployed to production as `minyoi-isa8ijml4-securemj0411-7703s-projects.vercel.app`.
- Next production Daangn main worker ran at `2026-06-02T08:18:39Z`.
- Runtime logs no longer showed `daangn source health insert failed`.
- Latest `mvp_source_health(source='daangn')` row after deploy:
  - `checked_at`: `2026-06-02T08:18:17.307Z`
  - `status`: `healthy`
  - `reason`: `ok`
  - `mode`: `active`
  - `search_result_count`: `45098`
  - `rawUpserted`: `573`
  - `detailAttempts/detailParsed`: `8/8`
  - `detail_success_rate/detail_404_rate/detail_5xx_rate`: `1/0/0`
- A following lifecycle run recorded:
  - `source_health_daangn_fresh: 1`
  - `source_health_bunjang_fresh: 1`
  - `source_health_joongna_fresh: 1`

## Follow-up

- Source health stale/missing is fixed.
- The next real bottleneck is lifecycle throughput:
  - sample run: `claimed=165`, `enriched=0`, `timedOut=true`
  - this points to lifecycle claim/recheck execution cost, not source health gating.
