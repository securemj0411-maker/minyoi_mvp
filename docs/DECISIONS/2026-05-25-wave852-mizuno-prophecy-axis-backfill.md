# Wave 852 — Mizuno Wave Prophecy axis backfill

## Context

Safety after wave 851 surfaced one remaining shoe `fix_now`: `shoe-mizuno-wave-prophecy`. The broad ready rows were not a new matcher bug. Current matching already identified explicit sub-lines, but old raw/pool rows still carried the legacy broad SKU and comparable key.

Polluted examples:

- Wave Prophecy Beta
- Wave Prophecy LS
- Wave Prophecy MOC
- Graphpaper x Mizuno Wave Prophecy
- Blankof x Mizuno Wave Prophecy

## Decisions

1. Keep the broad Mizuno Wave Prophecy lane blocked.
   - `mizuno_wave_prophecy` stays blocked in lane readiness.
2. Backfill all explicit sub-line rows into their exact ready lanes.
   - `shoe-mizuno-wave-prophecy-moc`
   - `shoe-mizuno-wave-prophecy-beta`
   - `shoe-mizuno-wave-prophecy-ls`
   - `shoe-mizuno-wave-prophecy-graphpaper`
   - `shoe-mizuno-wave-prophecy-blankof`
3. Do not reject valid Mizuno rows when the sub-line is explicit.
   - Dry-run had rejectRows 0, so the correct action was reclassify/refresh rather than null.

## Applied DB routing

Wave 852 apply:

- scannedParsedRows: 41
- rawRows: 41
- candidateRows: 35
- reclassifyRows: 32
- refreshParsedRows: 3
- rejectRows: 0

## Verification

- Stage after apply:
  - queued: 30
  - poolUpserted: 1006
  - reveal_current_profit_updated: 12
  - reveal_current_profit_invalidated: 1
- Gate cleanup:
  - candidateRows: 0
- Final safety:
  - shoe readySku 80, safe_public 77, probably_safe 3, fix_now 0
  - clothing readySku 46, safe_public 38, probably_safe 8, fix_now 0

## Deferred

- Generic `shoe-mizuno-wave-prophecy` remains blocked until model-missing rows have enough clean public evidence.
- Future raw sweeps should keep checking whether "9", "Neo", or GTX variants need their own lanes instead of falling into LS/MOC/Beta.
