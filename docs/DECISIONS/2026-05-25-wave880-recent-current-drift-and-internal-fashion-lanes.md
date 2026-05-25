# 2026-05-25 Wave880 Recent Current Drift And Internal Fashion Lanes

## Scope
- Continued the latest clothing/shoe/golf/game console deep sweep after Wave879.
- Prioritized current parser drift, stale raw SKU rows, visible pool safety, and sample pollution patterns in recently observed rows.
- This wave did not promote broad uncertain SKU groups. New uncertain product axes were kept internal-only unless already proven by readiness.

## Decisions
- Added exact internal learning lanes for recent clothing drift.
  - `clothing-stone-island-pants`: Stone Island pants/jogger/cargo/utility pants now route away from overshirt/broad lanes and stay out of public pool.
  - `clothing-supreme-wildcat-puffer`: Supreme 23FW Wildcat puffer/down jacket routes to a distinct internal lane instead of generic Supreme apparel.
- Tightened Stone Island separation.
  - Overshirt now rejects pants/jogger/cargo wording.
  - Shadow Project now accepts Korean shadow spellings (`쉐도우`, `섀도우`) so shadow pants do not fall into generic pants/overshirt behavior.
  - Junior/kids Stone rows are blocked from the new pants lane.
- Tightened Crocs slipper broad against other-brand bait.
  - Other-brand slipper wording such as Nike/Jordan/Adidas/New Balance + `크록스` now rejects instead of attaching to Crocs slipper samples.
  - Normal Crocs sandal/slipper wording still matches.
- Extended Carhartt denim pants coverage for observed safe wording.
  - Added `marlow`, `말로우`, and `진청`.
- Fixed report false positives before using the sweep as a work queue.
  - Clothing `유틸리티 팬츠/자켓/조끼` no longer trips the golf utility-club detector.
  - Nike colorway `light iron ore` no longer trips the golf iron detector.
  - `UNKNOWN` stored condition with conservative `b_grade` comparable key is treated as expected fallback, not an actionable mismatch.
- Backfilled one stale raw misclassification.
  - `남.95) 나이키 남성 반팔티, 연한 검정 / 나이키 폴로 매치업 반팔티` was previously stored as Polo Pony Tee.
  - Current catalog correctly rejects it; the parsed row was updated to rejected. This row was not in the visible pool.

## Applied Result
- Latest no-pool current drift cleanup:
  - scanned 22, candidates 20, reclassify 9, refresh 11, reject 0.
  - Fixed Vans/Birkenstock/Jordan/AMBUSH/MM6/Sacai condition-tier refreshes and Thom Browne/RRL exact SKU drift.
- Stone Island pants, Crocs bait, and condition drift cleanup:
  - first batch: scanned 11, candidates 10, reclassify 7, refresh 2, reject 1.
  - broader Stone pants batch: scanned 35, candidates 33, reclassify 32, refresh 1, reject 0.
- Remaining recent current drift cleanup:
  - scanned 10, candidates 8, reclassify 6, refresh 2, reject 0.
- Stale Nike Polo Matchup raw cleanup:
  - scanned 1, candidates 1, reject 1.
- Stage runs after the applied batches completed normally.
  - Larger Stone batch stage: queued 43, enriched 43, scored 1,598, poolUpserted 1,529, reveal_current_profit_invalidated 2.
  - The observed shoe ready SKU count settled at 82 because several rows were legitimately invalidated for economics (`sku_median_unavailable`, `profit_below_pack_band`, `negative_resell_gap`), not because of a parser block.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts`: 74 passed.
- Latest cross-category current replay:
  - auditedRows 200, flaggedRows 40, actionableRows 0.
  - poolRowsReadyOrReserved 0, poolActionableRows 0.
- Fashion pool gate-blocked cleanup dry-run:
  - scannedRows 316, candidateRows 0.
- Shoe safety:
  - readySku 82, safe_public 80, probably_safe 2, fixNow 0.
- Clothing safety:
  - readySku 51, safe_public 43, probably_safe 8, fixNow 0.

## Deferred
- The watch/internal-only queues remain intentionally large because broad buckets still contain mixed product axes.
  - Shoe examples: New Balance 327 broad, Gucci broad, Converse Chuck 70 high broad, Adidas Tobacco broad, Nike Shox R4 broad.
  - Clothing examples: Thom Browne apparel broad, Polo apparel broad, Stone Island broad, Moncler broad, Carhartt apparel broad.
- Next sweep should continue from these watch queues and the larger current replay, promoting only exact lanes whose sample comparisons are clean.
