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
- Keep marketplace source labels separate from price-evidence labels. A candidate listing can be Joongna/Bunjang, while the market sample is still grouped by same product/status (`comparable_key` + condition), not by marketplace source.
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

## Follow-up — source filter
- A later production check showed Joongna is present in recent pool rows, but sparse enough to be visually buried in default mixed-source lists.
- Added `source` filtering to admin/public pool listing APIs and the operator pool UI.
- Operator can now click the source ready chip or use the source dropdown to view only Joongna/Bunjang rows.
- Production DB check at the time of this follow-up:
  - `ready_total=365`
  - recent ready by `added_at` top 80: `joongna=5`, `bunjang=75`
  - newest ready added row was Joongna: `아이패드 미니 7 a17 pro 준신동 팝니다`

## Follow-up — /me pool source selector
- Added the same source selector to the `/me` pool feed.
- `/api/packs/pool` now accepts `source=bunjang|joongna` and applies the source scope before category diversification, budget filtering, and response masking.
- `/me` UI now preserves `source` in the URL and reloads the feed when the operator selects `출처 전체`, `번개장터`, or `중고나라`.
- Verification:
  - `npx eslint src/app/api/packs/pool/route.ts src/components/explore-client.tsx`: passed.
  - `npm run build`: passed.

## Follow-up — admin source filter bug
- Operator reported selecting `중고나라 — 5건` in the admin candidate pool still showed the full mixed 365 ready rows.
- Root cause: admin/public pool APIs created a `pidScope` for `source`, but the paginated fetch path only treated price/SKU/search as external filters. Source-only filtering built the scope and then ignored it.
- Fix: include any `scopedPids` in the external filter path and reject rows not in the scoped pid set.
- Verification:
  - `npx eslint src/app/api/admin/pool-listings/route.ts src/app/api/public/pool-listings/route.ts`: passed.
  - `npm run build`: passed.

## Follow-up — source-agnostic market sample wording
- Operator corrected the product strategy: there is no separate “Joongna 시세” vs “Bunjang 시세” in the user-facing sample. The market price should be a social/common used-market price for the same product and condition.
- Decision: comparison sample/evidence remains source-agnostic (`comparable_key` + condition + safety filters). Marketplace source is only provenance for the original listing and optional operator filtering.
- Changed user/operator wording from `번개 ... 매물 기준/median/추이` to `통합 ... 매물 기준/median/추이` where it refers to the market sample.
- `/api/listings/[pid]/market-source` now returns `marketplaceSource`, `marketplaceLabel`, and source-aware `listingUrl` for the target listing and comparison rows, while preserving legacy `bunjangUrl` as a compatibility alias.
- Deferred: historical `mvp_market_price_daily` rows were not recomputed in this change; the code path already aggregates by product/condition, and Joongna volume will naturally join the same aggregate as source data grows.

## Follow-up — detail-access live verification parity
- Operator asked whether the `/me` product feed treats Joongna like Bunjang for live validation before users see details.
- Finding: already-opened `/api/packs/me` rows live-verify on page load, and pack-open reservation live-verifies before reveal. But `/api/packs/pool/detail-access` was only checking `ready` before consuming free/credit detail access.
- Fix: `detail-access` now loads the exact ready pool item and runs source-aware live verification before consuming the user's free view/credit.
- Bunjang path now checks raw/detail comment count >= 8, missing detail, sold-out signals, and live listing classification before detail access is granted.
- Joongna path now checks product detail fetch, 404 disappearance, `productStatus !== 0`, sold-out text signals, and live listing classification before detail access is granted.
- If live verification fails because the source is temporarily unstable, the route returns an error without spending the free view/credit.
- Deferred: Joongna comment-count blocking remains unavailable because current Joongna public product HTML does not expose a stable comment count field in the parser sample; `num_comment` remains `null` for Joongna rows until a reliable field/API is found.

## Follow-up — reveal modal source wording and Joongna images
- Operator found source drift inside the easy-view/detail modal: beginner copy and channel-profit cards still implied Bunjang-only comparison/resale even for Joongna listings.
- Fix: beginner trust, payment, market/channel copy now uses the listing marketplace label or generic `중고 마켓` wording instead of Bunjang-only text where the logic is source-agnostic.
- Fix: resale comparison now shows Bunjang, Joongna, and Daangn cards. Bunjang/Joongna use the same conservative marketplace-fee estimate; Daangn remains local/direct-trade upside with region/negotiation burden.
- Fix: detail-modal images are marked `unoptimized`, and `next.config.ts` now allows `**.joongna.com` image hosts so Joongna CDN thumbnails render in the detail modal and beginner view.
- Deferred: Joongna-specific exact payment/fee policy is not hardcoded. UI says to confirm 안전거래/수수료 in the original listing, while profit math keeps using the existing conservative marketplace-fee estimate.
