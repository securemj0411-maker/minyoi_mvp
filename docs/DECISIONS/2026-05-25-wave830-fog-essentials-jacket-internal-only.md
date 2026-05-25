# Wave 830 — FOG Essentials jacket broad internal-only

## Context
- `clothing-fog-essentials-jacket` was public-ready but clothing safety flagged it because market sample depth was only 4.
- Raw sweep showed two problems:
  - stale other-brand `Essentials` rows from Adidas/New Balance
  - true FOG rows mixed across anorak, denim/trucker, coach/track, puffer/down, and coat

## Decision
- Move `fog_essentials_jacket` from ready to `internal_only`.
- Keep recognition for FOG jacket/anorak rows so future samples can be studied.
- Reject or reclassify other-brand Essentials rows away from FOG.
- Do not create public exact jacket sub-lanes until there is enough clean depth per subtype.

## Applied
- Reclassified 2 stale Adidas Essentials rows away from FOG jacket.
- Refreshed 6 true FOG jacket/anorak/coat rows under the now-internal jacket lane.
- Rejected 1 style-reference row (`피오갓 에센셜 스타일 리바이스`).
- Invalidated the existing public ready FOG jacket row after the lane became internal-only.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts` passed: 35/35.
- `cleanup-fashion-pool-gate-blocked --apply` invalidated 1 FOG jacket ready row.
- Follow-up `cleanup-fashion-pool-gate-blocked` dry-run: 0 candidates.
- `run-market-stats-stage-once --limit=800` completed.
- Clothing safety:
  - ready SKU: 47
  - safe_public: 36
  - probably_safe: 11
  - fix_now: 0

## Deferred
- Potential future exact lanes: FOG Essentials anorak, denim/trucker jacket, coach/track jacket, puffer/down jacket.
