# 2026-05-25 Wave836 — Patagonia subtype product-key cleanup

## Context
- Operator feedback showed Patagonia Down samples mixing `Nano Puff Vest`, `Wanaka Down Jacket`, and `Nano Puff Pullover`.
- This was not a catalog brand mismatch. The root issue was parser subtype collapse:
  - `Nano Puff Vest` could parse as `down_jacket`.
  - `Nano Puff Pullover` could parse as `down_jacket`.
  - `다운 스웨터 후디` could parse as `knit`.
- Mixing these into one comparable key can produce bad sample comparisons even when the SKU id itself is correct.

## Decision
- Keep `clothing-patagonia-down` as the SKU, but split comparison by product type more accurately.
- Make vest detection win before down-jacket model tokens.
- Treat explicit `Nano Puff Pullover` as `jacket`, not `down_jacket`.
- Treat `다운 스웨터` / `down sweater` as `down_jacket`.

## Implemented
- Updated `src/lib/parsers/wave92-fashion-mobility.ts`.
- Added regression coverage in `tests/fashion-catalog-regression.test.ts`:
  - `Nano Puff Vest` -> `clothing|patagonia_down|vest|...`
  - `Nano Puff Pullover` -> `clothing|patagonia_down|jacket|...`
  - `다운 스웨터 후디` -> `clothing|patagonia_down|down_jacket|...`
- Ran test suite: `tests/fashion-catalog-regression.test.ts` passed `39/39`.

## DB apply
- Applied current catalog reclassification with `--apply`.
- Result:
  - scannedParsedRows: 88
  - rawRows: 88
  - candidateRows: 11
  - reclassifyRows: 0
  - refreshParsedRows: 11
  - rejectRows: 0
- This wave was a parsed-key refresh wave, not a public/internal SKU migration.

## Post-apply stage
- Ran market stats stage once.
- Result included:
  - queued/enriched: 72
  - scored: 1819
  - poolUpserted: 1598
  - reveal_current_profit_updated: 26
  - reveal_current_profit_invalidated: 7
- Ran gate cleanup with `--apply`.
- Cleanup invalidated 2 stale gate-blocked pool rows:
  - shoe: 1
  - clothing: 1

## Safety report after wave
- Clothing ready SKUs: 47
- `safe_public`: 37
- `probably_safe`: 10
- `fix_now`: 0
- `clothing-patagonia-down` remains `probably_safe` only because historical operator feedback exists; current report shows `currentOther=0` and `currentNull=0`.

## Deferred
- Do not promote broad Patagonia apparel lanes. `clothing-patagonia-apparel-broad` remains watch/internal-only.
- Continue auditing the remaining clothing `probably_safe` lanes with historical feedback and low ready counts:
  - Polo knit / Oxford
  - Stussy hoodie / zip hoodie
  - RRL denim
  - BAPE zip hoodie
  - Lacoste pique
