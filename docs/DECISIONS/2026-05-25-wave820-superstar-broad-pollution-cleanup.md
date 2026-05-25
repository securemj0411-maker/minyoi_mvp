# Wave 820 Adidas Superstar Broad Pollution Cleanup

Date: 2026-05-25

## Context
- Continued shoe broad watch sweep after Mercurial exact split.
- `shoe-adidas-superstar-broad` had operator feedback about Superstar model ambiguity and fresh broad samples showed non-comparable rows.
- Existing exact lanes already cover BAPE, Superstar 82, Adifom, SFTM, and Sean Wotherspoon; this wave focused on residual broad pollution.

## Findings
- Residual Superstar broad pollutants:
  - cap/hat accessory row.
  - golf shoe row.
  - Human Made collab.
  - Willy Chavarria collab.
  - Beyonce platform collab.
  - Disney collab.
  - Lego object/listing.
- Ordinary Superstar white/black and normal colorways still match broad, but broad stays internal-only.

## Decisions / Changes
- Added Superstar broad guards for:
  - `볼캡`, `모자`, `cap`
  - `골프화`, `golf`
  - Human Made
  - Willy Chavarria
  - Beyonce
  - Disney
- Added regression coverage that those rows reject while ordinary Adidas Superstar still matches broad.

## DB Mutations Applied
- Rejected 7 stale Superstar broad parsed rows:
  - reason: `wave820_superstar_broad_pollution_cleanup`
- Market stats refresh after apply:
  - `timedOut=false`
  - `scored=613`
  - `poolUpserted=554`
  - `upserted=63`
  - `market_invalidation_claimed_shoe_keys=1`

## Verification
- Regression:
  - `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 25/25 passed.
- All-category current reparse cleanup dry-run:
  - `scannedPoolRows=524`
  - `candidateRows=0`
  - `invalidatePoolRows=0`
  - `reclassifyRows=0`
  - `rejectRows=0`
- Shoe SKU safety:
  - `catalogSku=633`
  - `nonEmptySku=488`
  - `readySku=72`
  - `safe_public=65`
  - `probably_safe=7`
  - `fix_now=0`

## Deferred / Follow-Up
- Do not release `shoe-adidas-superstar-broad`.
- Superstar II / XLG / Premium can be split later if repeatable sample support appears.
- Nike Dunk broad and Gucci broad remain higher-risk follow-up candidates.
