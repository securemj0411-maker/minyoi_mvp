# 2026-05-25 Wave842 — Stussy vintage other-brand fix_now cleanup

## Context
- After the Acne wave, the clothing safety report surfaced one `fix_now`:
  - `clothing-stussy-vintage-collab`
  - ready row `pid=396094922`
  - title: `00s 올드 마운틴 하드웨어 바람막이 자켓 L (103)`
  - current matcher: `clothing-mountain-hardwear-broad`
- Root cause: Stussy vintage/collab lane used broad era words (`00s`, `올드`) and did not block Mountain Hardwear.

## Decision
- Add Mountain Hardwear as an explicit blocker to Stussy vintage/collab.
- Do not run a broad Stussy vintage key apply, because dry-run showed it could pull some basic Stussy tee rows into vintage due description/context.
- Apply only the offending pid by `--pids` to avoid collateral promotion.

## Implemented
- Updated `src/lib/generated/catalog-715-clothing-narrow.ts`.
- Added regression coverage in `tests/fashion-catalog-regression.test.ts`.
- Test suite passed: `44/44`.

## DB apply
- Applied current catalog reclassification with `--pids=396094922 --apply`.
- Result:
  - scannedParsedRows: 1
  - rawRows: 1
  - candidateRows: 1
  - reclassifyRows: 1
  - refreshParsedRows: 0
  - rejectRows: 0
- The row moved from `clothing-stussy-vintage-collab` to `clothing-mountain-hardwear-broad`.

## Post-apply stage
- Ran market stats stage once.
- Result:
  - queued/enriched: 26
  - scored: 1318
  - poolUpserted: 1133
  - reveal_current_profit_updated: 13
  - reveal_current_profit_invalidated: 6
- Gate cleanup with `--apply` invalidated one stale shoe internal-only row; no new clothing blocked public rows remained.

## Safety report after wave
- Clothing ready SKUs: 47
- `safe_public`: 38
- `probably_safe`: 9
- `fix_now`: 0

## Deferred
- Stussy vintage/collab still needs a separate deep audit before broad promotion of old/basic tee rows. The full-key dry-run was intentionally not applied.
- Mountain Hardwear broad is a separate public lane and should be audited in a later outdoor/broad pass.
