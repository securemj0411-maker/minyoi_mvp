# Wave 826 — Asics Metaspeed apparel/spike cleanup

## Context
- Shoe SKU safety still showed `shoe-asics-metaspeed` as `probably_safe`.
- Raw/current samples showed the lane was mostly real road-racing shoes, but had stale matches for:
  - Asics Metaspeed singlets
  - Asics Metaspeed half tights
  - Asics Metaspeed MD track spikes
- A valid shoe sample also used brandless wording: `메타스피드 스카이 파리 250mm`.

## Decision
- Keep `shoe-asics-metaspeed` public-ready.
- Add apparel and track-spike blockers to both Metaspeed catalog entries.
- Add a narrow direct match for brandless Metaspeed only when a shoe line axis is explicit (`Sky`, `Edge`, `Ray`, `Tokyo`, `Paris`, `Ekiden`, `+`) and apparel/spike tokens are absent.
- Do not open generic one-word `메타스피드` broadly.

## Applied
- Rejected stale non-comparable rows:
  - `340695421` — Metaspeed MD track spike
  - `358210242` — Metaspeed singlet
  - `409583211` — Metaspeed singlet
  - `409729967` — Metaspeed half tights
  - `7000714103077` — Metaspeed singlet
- Refreshed Metaspeed parsed key for a real road-shoe row.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts` passed: 31/31.
- `run-market-stats-stage-once --limit=800` completed without ready collapse.
- `report-shoe-sku-safety --category=shoe`:
  - ready SKU: 69
  - safe_public: 66
  - probably_safe: 3
  - fix_now: 0

## Deferred
- No exact Sky vs Edge split yet. Current samples do not show enough public-pool price pollution to justify splitting within Metaspeed today.
