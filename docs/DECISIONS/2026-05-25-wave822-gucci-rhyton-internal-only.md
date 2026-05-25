# Wave 822 Gucci Rhyton Public Lane Pause

Date: 2026-05-25

## Context
- Continued shoe safety sweep after Wave 821 Dunk cleanup.
- `shoe-gucci-rhyton` was still public-ready but safety report showed it as `probably_safe` with operator feedback.
- Live raw samples showed one public lane was mixing too many Rhyton variants to be a safe comparison set.

## Findings
- `shoe-gucci-rhyton` samples included:
  - Dirty / Lip Dirty
  - GG / GG multi
  - Square logo
  - 25 print
  - 1921 / Eschatology
  - Wave
  - Mouse print
  - Chunky sole / canvas logo variants
  - Glitter, apple, star, black iridescent
- Prices ranged roughly from sub-100k used rows to 1M+ boutique rows.
- Existing guards already blocked 100th-anniversary / limited / GD / CDG-like pollution, but the plain Rhyton SKU was still too broad for public market matching.

## Decisions / Changes
- Changed `gucci_rhyton` lane readiness from `ready` to `internal_only`.
- Kept catalog recognition intact so future raw rows can continue to be learned and later split.
- Added regression coverage:
  - ordinary `구찌 라이톤 입술더티` still maps to `shoe-gucci-rhyton`;
  - pool gate blocks it while internal-only;
  - `100주년 한정판 라이톤` still does not map to plain Rhyton.

## DB Mutations Applied
- Applied gate cleanup:
  - reason: `wave822_gucci_rhyton_internal_only_gate`
  - scanned shoe pool rows: 139
  - candidate rows: 1
  - invalidated pool rows: 1
  - affected ready row: pid `389615769`, `[9] 구찌 라이톤 입술더티 스니커즈`.

## Market Refresh
- `timedOut=false`
- `scored=618`
- `poolUpserted=522`
- `upserted=63`

## Verification
- Regression:
  - `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 27/27 passed.
- All-category current reparse cleanup dry-run after apply:
  - `scannedPoolRows=522`
  - `candidateRows=0`
  - `invalidatePoolRows=0`
  - `reclassifyRows=0`
  - `rejectRows=0`
- Shoe SKU safety:
  - `catalogSku=633`
  - `nonEmptySku=490`
  - `readySku=71`
  - `safe_public=65`
  - `probably_safe=6`
  - `fix_now=0`

## Deferred / Follow-Up
- Do not release plain `gucci_rhyton` until exact variant lanes are split and sample-supported.
- Possible future exact lanes:
  - Rhyton Dirty / Lip Dirty
  - Rhyton GG / GG Multi
  - Rhyton Square Logo
  - Rhyton Star
  - Rhyton Wave / Mouse / 25 / 1921 if repeated samples justify it.
