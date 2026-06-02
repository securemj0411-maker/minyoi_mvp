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
- Added regression tests for both contracts.

## Verification

- `npx tsx --test --test-name-pattern "score RPC" tests/core-rules.test.ts`
  - `2 pass, 0 fail`
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

- Production verification after deploy:
  - compare next score-worker `score_load_rows` against the pre-fix `~96s`
  - expected target: single-digit to low tens of seconds, with nonzero scoring when dirty rows exist
- Landing showcase sold-listing query should be fixed separately with an index/RPC/cache strategy.
