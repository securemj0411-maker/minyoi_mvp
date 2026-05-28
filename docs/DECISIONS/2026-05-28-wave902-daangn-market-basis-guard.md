# Wave 902 - Daangn Market Basis Guard

Date: 2026-05-28

## Decision

Daangn recommendations need a usable Daangn same-source market basis before detail access can proceed.

The user reported Daangn detail pages where S-grade or B-grade listings were shown as `보류` with `+0원`, even though the original listing was not sold. Root causes:

- Daangn source-strict market basis could be missing or below the 3-sample threshold, but detail access could keep older pool profit snapshots.
- `/me` detail refresh still had a client-side recomputation path using the old Bunjang-style resale fee and reshipping constants.
- The modal UI labeled every zero-profit case as `판매완료 처리`, even when the actual reason was missing market basis or profit refresh.

## Changes

- Detail access now invalidates Daangn ready rows when Daangn same-source market basis is missing or has fewer than 3 samples.
- The invalidation reason is now `daangn_market_basis_missing`, with a user message explaining that Daangn comparison listings are still insufficient.
- `/me` API now sets Daangn current profit to `0` when same-source market basis is missing, instead of falling back to stale snapshots.
- `/me` client-side detail refresh now uses canonical `expectedProfitFromMarketPrice`, so Daangn keeps `0원` resale fee and `0원` reshipping.
- Detail modal no longer labels generic zero-profit/market-basis holds as `판매완료 처리`; it shows `시세 근거 부족` or `보류 처리`.
- “Why cheap” copy no longer says a listing is cheap when there is no usable market basis.

## Deferred

- A first-class server-side reason field for detail modal hold states would be cleaner than inferring from market basis and profit. Current fix is intentionally scoped to stop misleading Daangn recommendations and copy.
