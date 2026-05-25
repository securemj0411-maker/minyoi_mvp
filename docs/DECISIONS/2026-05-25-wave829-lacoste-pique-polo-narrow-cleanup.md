# Wave 829 — Lacoste pique polo narrow cleanup

## Context
- Clothing safety showed `clothing-lacoste-pique-polo` as `probably_safe`.
- Raw sweep showed the old rule accepted `셔츠/shirt` too broadly, so Lacoste linen/check shirts, knit polo sweaters, dresses, long-sleeve polos, and a down vest were entering the same pique polo sample space.
- Lacoste apparel broad was public-ready, which could let those non-pique garments remain public under a broad lane.

## Decision
- Narrow `clothing-lacoste-pique-polo` to explicit `피케/pk/폴로/카라티` wording.
- Exclude shirt-only, dress, knit/sweater/cardigan, down/puffer/vest, long-sleeve, and golf wording from the pique polo lane.
- Move `lacoste_apparel_broad` to `internal_only` until exact Lacoste garment lanes exist.
- Add CDG/Comme des Garcons blockers to Lacoste broad.

## Applied
- Reclassified 38 stale Lacoste pique rows to internal Lacoste broad.
- Refreshed 41 true pique/polo rows under the narrowed key.
- Rejected 9 non-comparable rows such as golf, dress, CDG collab, and cardigan rows.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts` passed: 34/34.
- `cleanup-fashion-pool-gate-blocked --apply` removed 1 unrelated blocked Mizuno ready row found during verification.
- Follow-up `cleanup-fashion-pool-gate-blocked` dry-run: 0 candidates.
- `run-market-stats-stage-once --limit=800` completed.
- Clothing safety:
  - ready SKU: 48
  - safe_public: 36
  - probably_safe: 12
  - fix_now: 0

## Deferred
- Lacoste broad remains internal-only. Future exact lanes can be added for Lacoste shirts, knit polos, dresses, and golf apparel if enough clean samples accumulate.
