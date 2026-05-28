# Wave 906 — Daangn firehose preflight window throughput

Date: 2026-05-28

## Trigger

User wants Daangn ready throughput closer to 1,000/day and questioned whether stale `profit_below_pack_band`/band policy is still constraining the pool.

## Findings

- `profit_below_pack_band` was a stale reason name. The old band entry threshold was already removed in Wave 885; current entry threshold is positive profit after costs.
- Latest Daangn 24h invalidations showed `profit_below_pack_band` was only a tiny slice, so it is not the main bottleneck.
- Daangn worker is fetching the full 267-region firehose successfully, but the raw write preflight only inspected the freshest 1,500 catalog-hint rows.
- Recent production run example:
  - fetched ~35k Daangn articles
  - catalog-hint candidates ~1.6k
  - preflight candidates 1,500
  - preflight skipped as already-seen 1,477
  - actual classify/upsert candidates 23
- This means already-seen rows near the top can hide fresh candidates behind the preflight window.

## Decision

Keep the expensive write/classify cap unchanged, but widen the cheap preflight window.

Changed `src/lib/daangn-ingest.ts`:

- `DAANGN_UPSERT_PREFLIGHT_MULTIPLIER`: 3 → 10
- `DAANGN_UPSERT_PREFLIGHT_MAX`: 2,000 → 5,000
- Existing-row preflight read chunk: 100 → 250

Expected effect:

- When the firehose repeats many already-seen rows, the worker can still reach deeper fresh candidates in the same run.
- The actual classify/write cap remains controlled by `maxUpsertArticles`, so this should improve throughput without opening an uncontrolled DB write flood.

## Deferred

- If same-source Daangn market stats remain the next bottleneck, decide separately whether to add an explicit “buy on Daangn, resell on Bunjang/Joongna” lane. Do not silently mix resale basis into Daangn-source recommendations.
- New future “no profit after costs” invalidations use `profit_not_positive_after_costs`; legacy `profit_below_pack_band` remains counted/recoverable for compatibility.

## Verification

- Updated `tests/daangn-ingest.test.ts` preflight-window expectations.
