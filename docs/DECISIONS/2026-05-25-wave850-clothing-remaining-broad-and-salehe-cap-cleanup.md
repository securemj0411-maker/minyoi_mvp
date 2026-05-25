# Wave 850 — Clothing remaining broad routing and Salehe cap cleanup

## Context

After wave 849, the next clothing watch/internal broad families were:

- TNF Nuptse broad
- Lacoste broad
- Uniqlo broad
- Neighborhood broad
- Nike tee broad
- Junya Watanabe broad
- Adidas tee broad
- Tommy Hilfiger broad
- Patagonia broad
- Canada Goose broad

The dry-run showed most current changes were safe refreshes, but TNF Nuptse still had repeated variant patterns that were being rejected to null or left in broad. Those patterns need learning lanes so future raw rows do not keep falling through.

## Decisions

1. Keep all reviewed broad clothing lanes internal/watch-only.
   - None of these broad families were promoted to public readiness.
2. Add internal TNF learning lanes for repeated Nuptse variants.
   - `clothing-tnf-nuptse-1992`
   - `clothing-tnf-nuptse-vest`
   - `clothing-tnf-nuptse-eco`
   - `clothing-tnf-nuptse-special`
3. Keep White Label / Novelty routed to its existing lane, while blocking it from generic Nuptse broad and generic Nuptse vest.
4. Keep true non-comparable TNF rows rejected.
   - `노스페이스 눕시 셔츠` remains null because it is not a down jacket or vest comparable.
5. Fix newly surfaced shoe ready pollution immediately.
   - `shoe-newbalance-salehe-collab` was matching `뉴발란스 살레헤 벰버리 캡`.
   - Added cap/hat/apparel/bag blockers directly to the Salehe sneaker SKU and rejected the polluted current pid.

## Applied DB routing

Wave 850 clothing apply:

- scannedParsedRows: 644
- rawRows: 644
- candidateRows: 127
- reclassifyRows: 46
- refreshParsedRows: 80
- rejectRows: 1

Notable routing:

- TNF Nuptse broad -> TNF Eco Nuptse internal lane
- TNF Nuptse broad -> TNF 1992 Nuptse internal lane
- TNF Nuptse broad -> TNF Nuptse Special internal lane
- TNF Nuptse broad/null -> TNF Nuptse Vest internal lane
- TNF Nuptse broad/null -> TNF White Label / Novelty
- Adidas Trefoil tee rows -> Adidas tee broad internal lane
- Patagonia Retro-X/Synchilla unsafe rows -> Patagonia broad internal lane

Salehe cap follow-up:

- pid `397785871` (`뉴발란스 살레헤 벰버리 캡`) was reclassified to null/review.
- The Salehe sneaker SKU now directly blocks caps, hats, apparel, and bags.

## Verification

- Regression: `npx tsx --test tests/fashion-catalog-regression.test.ts` passed 49/49.
- Stage after clothing apply:
  - queued: 37
  - poolUpserted: 1824
  - reveal_current_profit_updated: 17
  - reveal_current_profit_invalidated: 1
- Stage after Salehe cap fix:
  - queued: 79
  - poolUpserted: 1379
  - reveal_current_profit_updated: 2
  - reveal_current_profit_invalidated: 0
- Gate cleanup:
  - after clothing apply: 3 rows cleaned (shoe 2, clothing 1)
  - after Salehe fix: 1 shoe row cleaned
- Safety after all fixes:
  - clothing readySku 45, safe_public 37, probably_safe 8, fix_now 0
  - shoe readySku 73, safe_public 70, probably_safe 3, fix_now 0

## Deferred

- TNF 1992 / Vest / Eco / Special are intentionally internal-only until sample groups are large and clean enough for public readiness.
- White Label / Novelty remains in its existing ready lane, but future sample spread should be watched because vest/down variants now surface more cleanly.
- Adidas tee broad, Patagonia apparel broad, Nike tee broad, and Canada Goose broad remain internal/watch-only; they were refreshed for current consistency, not released.
