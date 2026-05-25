# Wave 859 — Shoe next high-eligible broad cleanup

## Context

After wave 858, the next high-eligible `watch_internal_only` shoe lanes included luxury broad families and football boot broad families. This wave reviewed:

- `shoe-dior-broad`
- `shoe-hermes-broad`
- `shoe-nike-tiempo-broad`
- `shoe-nike-mercurial-broad`
- `shoe-newbalance-530-broad`
- `shoe-louisvuitton-broad`
- `shoe-nike-shox-tl-broad`
- `shoe-converse-chuck-allstar-broad`
- `shoe-vans-vault-broad`
- `shoe-drmartens-broad`

## Decisions

1. Keep Patta x Nike Mercurial rows out of generic Mercurial broad and out of `Vapor 16 Elite FG`. Patta is a special/collab axis and should not pollute the normal FG sample.
2. Keep Yeseyesee x New Balance 530 rows out of generic NB530 broad until a dedicated collab lane is intentionally created.
3. Reclass explicit Mercurial exact boot axes out of broad:
   - Vapor 16 Elite AG
   - Vapor 14 Elite AG
   - Vapor 15 Pro TF
4. Keep generic/under-specified Mercurial rows in broad/internal watch. Do not promote broad football boot rows without explicit generation + tier + surface.
5. Do not promote the audited luxury broad lanes from this pass. No deterministic reclass/reject candidate surfaced for Dior/Hermes/LV broad in this bounded current-key sweep.

## Code changes

- Added Patta blockers to Nike Mercurial broad and Vapor 16 Elite FG.
- Added Yeseyesee blockers to both NB530 broad definitions.
- Added regression coverage for:
  - Patta Mercurial rejection
  - Yeseyesee NB530 rejection while plain NB530 remains matched

## Applied DB routing

Wave 859 broad batch apply:

- scannedParsedRows: 602
- rawRows: 602
- candidateRows: 73
- reclassifyRows: 5
- refreshParsedRows: 63
- rejectRows: 5

Notable rows:

- `shoe-nike-mercurial-broad` -> `shoe-nike-mercurial-vapor-16-elite-ag`: pid `403536026`
- `shoe-nike-mercurial-broad` -> `shoe-nike-mercurial-vapor-14-elite-ag`: pids `401586253`, `401586565`
- `shoe-nike-mercurial-broad` -> `shoe-nike-mercurial-vapor-15-pro-tf`: pids `329553286`, `7000194667903`
- `shoe-nike-mercurial-broad` -> null/review: Patta x Mercurial rows
- `shoe-newbalance-530-broad` -> null/review: Yeseyesee x NB530 rows

## Verification

- Regression: `npx tsx --test tests/fashion-catalog-regression.test.ts` passed 58/58.
- Stage after apply:
  - queued: 52
  - poolUpserted: 1622
  - reveal_current_profit_updated: 42
  - reveal_current_profit_invalidated: 11
- Gate cleanup:
  - first pass candidateRows: 1, applied shoe rows: 1
  - final pass candidateRows: 0
- Final safety:
  - shoe readySku 84, safe_public 81, probably_safe 3, fix_now 0
  - clothing readySku 49, safe_public 41, probably_safe 8, fix_now 0

## Deferred

- Consider dedicated internal/exact lanes later for Patta Mercurial and Yeseyesee NB530 if enough clean live samples appear.
- Continue shoe sweep with the remaining `watch_internal_only` broad lanes after Dr. Martens broad: additional Nike/Adidas/ASICS/Crocs/Puma/Hoka/Vans/Converse families and any new `fix_now` from fresh pool movement.
