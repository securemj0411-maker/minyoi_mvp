# Cron Catch-up Burst

- generatedAt: 2026-05-13T22:40:00Z
- decision: missed overnight cron window should be recovered with bounded catch-up bursts, not by permanently over-tightening normal cadence.

## Manual Catch-up Result

Commands executed against local cron endpoints:

- `deep-crawl?wait=1&page=1`
- `deep-crawl?wait=1&page=2`
- `deep-crawl?wait=1&page=3`
- `tick?wait=1`

Results:

- deep-crawl page 1 ran successfully:
  - collected 3,744
  - searchSucceeded 39 / searchFailed 0
  - unique_items 3,476
  - rawFullUpsertRows 231
  - queued 5
  - changed_items 233
  - seller_upsert_rows 1,782
- deep-crawl page 2 and page 3 were skipped by cron guard cooldown:
  - retryAfterMs about 9.3 minutes
- tick ran successfully:
  - collected 3,744
  - searchSucceeded 39 / searchFailed 0
  - unique_items 2,856
  - rawFullUpsertRows 75
  - queued 4
  - scored 85
  - poolUpserted 18
  - poolSkipped 67

## Interpretation

One catch-up search run is still in the "thousands" range when the query set is due or cadence is bypassed:

- current query count: 39
- search mode page size: 96 for fresh/deep search
- theoretical item fetch per full pass: 39 × 96 = 3,744

The earlier impression that recent runs only fetched a few hundred came from cadence-gated ticks where many queries were skipped, not from the pipeline losing capacity.

## Policy

- Use `deep-crawl` as catch-up because it bypasses query cadence and rotates pages.
- Do not fire deep-crawl page 1/2/3 back-to-back; the guard enforces cooldown.
- Normal cadence should follow marketplace velocity and query yield.
- Catch-up should be a bounded burst after downtime: e.g. one deep-crawl now, another after cooldown, then normal tick/detail drain.
- If catch-up is needed often, add an explicit catch-up schedule instead of making normal tick permanently too aggressive.

## Next

- Add ready tech/home lane queries to the search query set; otherwise catch-up still mostly covers AirPods/Watch/MacBook/iPhone/iPad.
- Proposed catch-up schedule after downtime: deep-crawl every 10 minutes for 3 runs, then detail-worker every 3-5 minutes until queue drains, then normal cadence.
