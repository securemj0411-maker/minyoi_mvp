# Wave 825 Vans Style 36 Mule Cleanup

Date: 2026-05-25

## Context
- Continued shoe `probably_safe` audit after Yeezy 350 broad pause.
- `shoe-vans-style-36` still had operator feedback about Vault/OG/LX/Pop Trading examples.
- Existing guards already blocked Vault/OG/LX/Pop Trading/Japan from the plain Style 36 lane.

## Findings
- Live Style 36 samples were mostly clean plain Style 36 rows.
- One non-comparable silhouette remained:
  - `반스 스타일36 뮬 270`
- Mule/open-back Style 36 should not share the same public comparison lane as normal Style 36 sneakers.

## Decisions / Changes
- Added `뮬` / `mule` guards to `shoe-vans-style-36`.
- Kept plain Style 36 public-ready.
- Added regression coverage:
  - plain Style 36 still matches and passes pool gate.
  - mule silhouette rejects.
  - Vault/OG does not collapse into plain Style 36.

## DB Mutations Applied
- Applied current-catalog cleanup:
  - reason: `wave825_vans_style36_mule_cleanup`
  - scanned parsed rows: 30
  - candidate rows: 1
  - rejected rows: 1
  - affected pid: `335873142`.

## Market Refresh
- `timedOut=false`
- `scored=761`
- `poolUpserted=618`
- `upserted=54`
- `market_invalidation_claimed_shoe_keys=1`

## Verification
- Regression:
  - `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 30/30 passed.
- All-category current reparse cleanup dry-run after apply:
  - `scannedPoolRows=516`
  - `candidateRows=0`
  - `invalidatePoolRows=0`
  - `reclassifyRows=0`
  - `rejectRows=0`
- Shoe SKU safety:
  - `catalogSku=633`
  - `nonEmptySku=490`
  - `readySku=69`
  - `safe_public=65`
  - `probably_safe=4`
  - `fix_now=0`

## Deferred / Follow-Up
- Style 36 remains `probably_safe` only because historical operator feedback is still attached; current sample drift was cleaned.
- Continue with Asics Metaspeed stale-null and Hoka Satisfy / NB Casablanca feedback checks.
