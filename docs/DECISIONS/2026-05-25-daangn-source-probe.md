# 2026-05-25 Daangn source probe

## Decision

- Add a no-write Daangn public web probe before any runtime ingest.
- Scope the first probe to fashion/shoes because Daangn cadence is fast and source value depends on fresh bumped listings, not only raw result volume.
- Use `/kr/buy-sell/?in=<regionId>&category_id=<categoryId>&search=<keyword>` instead of `/kr/buy-sell/s/*`.
- Treat `boostedAt` as the primary cadence cursor. `createdAt` is secondary because sellers can bump older listings.
- Fetch detail pages only for `Ongoing` rows that are crawl-allowed and inside the active freshness window.
- Keep Daangn direct-trade-first until text or structured evidence says shipping is possible.

## Implemented

- `src/lib/daangn.ts`
  - Transparent no-write fetch helper.
  - Robots metadata parser.
  - Search URL builder that avoids `/kr/buy-sell/s/*`.
  - Remix payload parser for search and detail pages.
  - Freshness/cadence summary buckets:
    - fresh bumped within 24 hours
    - active bumped within 72 hours
    - stale bumped over N days
  - Detail candidate gate:
    - `status === "Ongoing"`
    - `webCrawlNotAllowed !== true`
    - `boostedAt || createdAt` inside active window
- `scripts/report-daangn-source-probe.ts`
  - No database writes.
  - Configurable by env:
    - `DAANGN_PROBE_REGIONS=name:id,name:id`
    - `DAANGN_PROBE_QUERIES=query,query`
    - `DAANGN_PROBE_MAX_COMBOS`
    - `DAANGN_PROBE_MAX_DETAIL_SAMPLES`
    - `DAANGN_PROBE_DELAY_MS`
    - `DAANGN_PROBE_ACTIVE_HOURS`
- `package.json`
  - Added `report:daangn-source-probe`.
- `tests/daangn-source-probe.test.ts`
  - Covers URL shape, block detection, search parser, detail parser, and detail candidate gate.

## Deferred

- No DB tables or writes yet.
- No `KnownMarketplaceSource` runtime union change yet.
- No candidate pool insertion yet.
- No admin UI yet.
- No cron cadence yet.
- No legal/robots policy final sign-off yet.

## Operating hypothesis

Daangn should not be crawled as a slow daily catalog. It should be treated as a fast local marketplace:

- Hot fashion/shoe region seeds: 15-30 minute polling after a low-rate soak.
- Cold seeds: 2-4 hour polling.
- Detail fetch: only for fresh `Ongoing` hits that survive parser/category gates.
- User-facing reveal: direct-trade region must be visible before credit consumption.

## Verification

- Unit probe contract:
  - `npx tsx --test tests/daangn-source-probe.test.ts`
  - 6 pass, 0 fail.
- Production build:
  - `npm run build`
  - Passed after replacing the regex `s` flag with a target-compatible pattern.
- Live no-write probe:
  - `DAANGN_PROBE_MAX_COMBOS=12 DAANGN_PROBE_MAX_DETAIL_SAMPLES=3 DAANGN_PROBE_DELAY_MS=450 npm run report:daangn-source-probe`
  - Decision: `source_safe_to_continue_probe_only`
  - Blocked combos: 0
  - Failed combos: 0
  - Executed combos: 12 / 36 requested
  - Articles: 94
  - Ongoing: 30
  - Crawl-allowed ongoing: 30
  - Fresh bumped within 24h: 0
  - Active bumped within 72h: 1
  - Unique ongoing URLs: 30
  - Detail samples fetched: 1

## Verification interpretation

- Search/detail payload viability is confirmed for the first fashion/shoe probe.
- The sample set shows many old `Ongoing` rows, so raw `Ongoing` count is not enough.
- `boostedAt` must drive cadence and detail fetch gating.
- The next implementation should start with a low-rate soak and avoid candidate-pool writes until freshness, dedupe, and direct-trade UX are all agreed.
