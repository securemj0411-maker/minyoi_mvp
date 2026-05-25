# Wave 853 — Shoe next broad routing cleanup

## Context

After wave 852, the next shoe watch/internal broad families were reviewed:

- Dior broad
- Nike Tiempo broad
- Nike Cortez broad
- Nike Mercurial broad
- Converse Chuck Taylor All Star broad
- New Balance 530 broad
- Louis Vuitton broad
- Nike Shox TL broad
- Vans Vault broad
- Dr. Martens broad

## Decisions

1. Keep these broad shoe lanes internal/watch-only.
   - No broad shoe family was promoted to public readiness.
2. Backfill legacy or stale rows to the current broad/internal lanes where appropriate.
   - Legacy `shoe-nike-cortez` rows now route to `shoe-nike-cortez-broad`.
   - Dr. Martens Flora/Maybelle rows move out of the 2976 Chelsea exact lane into broad/internal watch.
3. Split explicit Chuck 70 shape signals out of Converse All Star broad.
   - `70s` is now understood as Chuck 70 wording.
   - `70s high/high/하이` -> `shoe-converse-chuck70-high-broad`.
   - `70s low/ox/로우` -> `shoe-converse-chuck70-low-broad`.
   - high/low-missing `척70` rows -> `shoe-converse-chuck70-ambiguous` internal learning lane.
4. Fix Korean substring leakage in Converse matching.
   - `옐로우` no longer trips the `로우` blocker.
5. Fix Vans Vault Cap LX false rejects.
   - `Cap LX` in Vans Vault/Old Skool/Skate context is treated as a shoe model phrase.
   - Actual cap/hat rows remain rejected.
6. Keep risky rows rejected.
   - `교신ok` Dior row remains null.
   - `호날두st` Mercurial row remains null.
   - Korea/special edition Mercurial row remains null until exact special-edition evidence is available.

## Applied DB routing

Wave 853 apply:

- scannedParsedRows: 659
- rawRows: 659
- candidateRows: 105
- reclassifyRows: 33
- refreshParsedRows: 69
- rejectRows: 3

Notable routing:

- Converse All Star broad -> Chuck70 Low broad
- Converse All Star broad -> Chuck70 High broad
- Converse All Star broad -> Chuck70 Ambiguous internal lane
- Nike Mercurial broad -> Vapor 15 Pro TF exact lane
- legacy Nike Cortez -> Nike Cortez broad/internal watch
- Dr. Martens 2976 Chelsea stale rows -> Dr. Martens broad/internal watch

## Verification

- Regression: `npx tsx --test tests/fashion-catalog-regression.test.ts` passed 51/51 after routing fixes.
- Stage after apply:
  - queued: 139
  - poolUpserted: 1618
  - reveal_current_profit_updated: 27
  - reveal_current_profit_invalidated: 12
- Gate cleanup:
  - 2 shoe rows cleaned.
- Safety after wave 853 surfaced one remaining fix_now:
  - `shoe-adererror-converse-collab` had a cap accessory sample.

## Deferred

- Chuck70 ambiguous remains internal-only until enough rows reveal reliable high/low/model signals.
- Nike Tiempo, Cortez, Mercurial, Shox TL, Dior/LV, Vans Vault, and Dr. Martens broad lanes remain internal/watch-only.
- Mercurial Korea/special edition rows may need exact lanes later if they repeat with clean market depth.
