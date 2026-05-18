# 2026-05-18 Wave 216 — `/me` lazy liquidity analysis

## Problem
- Wave 214 added the liquidity curve to `/me` cards.
- That made every visible saved recommendation render rotation analysis before the user showed intent to inspect the item.
- `/api/packs/me` also batch-fetched velocity and SKU flow data for all listed items, even when users only wanted to scan the dashboard.

## Decision
- `/me` cards no longer render `LiquidityCurveMini`.
- `/api/packs/me` now keeps the list response focused on display fields, live lifecycle verification, current market price, and fee-aware current profit.
- Velocity and SKU flow are lazy-loaded through `/api/packs/reveals/detail` after the user clicks `상품 보기`.
- The detail response returns `analysis` alongside the listing detail, and the client merges that analysis back into the selected item so the existing modal market panel can show the rotation curve there.

## Deferred
- If the detail route grows further, extract the single-item market analysis loader into a shared library function so `/api/packs/reveals/detail`, admin views, and future mobile endpoints cannot drift.
