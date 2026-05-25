# Wave 827 — Hoka Satisfy Mafate / Clifton split

## Context
- `shoe-hoka-mafate-satisfy-collab` still showed `probably_safe` because an operator feedback row existed.
- Raw sweep showed three different patterns:
  - true Mafate Speed 4 rows with explicit `마파테`
  - true Mafate rows using only colorway shorthand such as `라이트커피`, `라이트러버`, `설퍼`
  - non-Mafate / non-sell rows such as `Clifton LS`, `구매글`, and generic `호카 새티스파이 콜라보`

## Decision
- Keep `hoka_mafate_satisfy` public-ready.
- Add colorway shorthand direct matching for Hoka x Satisfy Mafate only when the title has Hoka + Satisfy plus known Mafate color axis and no other model axis.
- Add `shoe-hoka-satisfy-clifton-ls-collab` as a new internal-only SKU so Clifton LS no longer falls into Mafate or Hoka broad.
- Add `새티스파이/세티스파이` blockers to Hoka broad.
- Add `구매글` to universal buy-request noise.

## Applied
- Reclassified:
  - `402358802` — Hoka x Satisfy Clifton LS -> `shoe-hoka-satisfy-clifton-ls-collab`
  - `408482741` — Hoka x Satisfy Clifton LS -> `shoe-hoka-satisfy-clifton-ls-collab`
- Rejected:
  - `402100136` — generic Hoka Satisfy collab, no model/color axis
  - `7003918002182` — purchase request / Clifton LS
- Refreshed Mafate colorway shorthand rows such as `라이트커피`, `라이트러버`, `설퍼`.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts` passed: 32/32.
- `cleanup-fashion-pool-gate-blocked` dry-run: 0 candidates.
- `apply-cross-category-current-reparse-cleanup` dry-run: 0 candidates.
- `run-market-stats-stage-once --limit=800` completed.
- `report-shoe-sku-safety --category=shoe`:
  - ready SKU: 69
  - safe_public: 66
  - probably_safe: 3
  - fix_now: 0

## Deferred
- Hoka x Satisfy Clifton LS is internal-only until there is enough clean public market depth.
- Hoka Mafate remains `probably_safe` only because of a legacy feedback marker; current-match pollution is 0.
