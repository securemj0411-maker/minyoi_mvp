# 2026-05-21 — Joongna source visibility in ready pool

## Context
- Joongna active ingest is already writing ready candidates into `mvp_candidate_pool`.
- DB check after deploy/env update showed `ready_total=365`, with `bunjang=361` and `joongna=4`.
- The UI/API path still treated candidate listings as Bunjang by default, so operators could not visually confirm whether a ready card came from Bunjang or Joongna.

## Decisions
- Add a shared marketplace source helper (`marketplace-source.ts`) for normalized source id, label, and listing URL fallback.
- Expose `marketplaceSource`, `marketplaceLabel`, and `listingUrl` from:
  - `/api/admin/pool-listings`
  - `/api/public/pool-listings`
  - `/api/packs/pool`
  - `/api/packs/pool/detail-access`
  - `/api/packs/me`
- Show source badges in:
  - admin/operator pool card rows and ready source stats
  - `/me` reveal cards
  - `/explore` cards
  - reveal detail modal header and original listing CTA
- Keep market-price basis labels separate. “번개 S급 median” still means price evidence came from Bunjang market stats, not necessarily that the listing itself is a Bunjang listing.
- Make live verification source-aware:
  - Bunjang listings still use Bunjang detail API and comment-count checks.
  - Joongna listings use Joongna product detail URL and productStatus/text sold checks.
  - Joongna fetch/block failures release/keep the candidate instead of incorrectly calling Bunjang and marking it disappeared.

## Deferred
- Joongna comment-count based filtering is not implemented because the current Joongna parser does not extract comments.
- A real Joongna brand asset was not added; UI uses a compact text badge until an official/local asset is available.
- Market graph evidence remains Bunjang/Danawa based until Joongna sold/price history aggregation is added.

## Verification
- `npx eslint` on touched source files: passed with only pre-existing `<img>` warnings in `market-brand-logo.tsx`.
- `npm run build`: passed.
- DB spot check: 4 Joongna ready candidates are active and have `https://web.joongna.com/product/...` URLs.
