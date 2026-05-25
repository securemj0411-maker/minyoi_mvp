# Wave 814 All-Category Runtime Readiness + SKU Safety Sweep

Date: 2026-05-25

## Context
- User asked to keep sweeping all categories without stopping, with shoe/clothing prioritized because sample comparables were still occasionally weird.
- The previous wave fixed fashion gate issues, but the next risk was whether the cleanup/report scripts were judging rows with the same readiness source used by the runtime scoring path.
- During the all-category sweep, a stale readiness mismatch made electronics rows look blocked even though the runtime DB readiness table allowed them.

## Decisions / Changes
- Treat runtime readiness as the source of truth for reports and cleanup:
  - `scripts/report-cross-category-db-deep-sweep.ts` now loads DB category/lane readiness through the same runtime readiness loaders used by scoring.
  - `scripts/apply-cross-category-current-reparse-cleanup.ts` now uses the same runtime DB+code readiness map.
  - This prevents cleanup from invalidating rows based on stale code constants when the scoring pipeline is already using DB readiness.
- Reduced false positives in all-category deep sweep:
  - Category conflict checks now use title signals instead of description-only bait.
  - Removed repeated false flags such as bootcut pants wording, Iron Grey color text, Air Force Utility, and denim shoe material text.
  - Added `--categories=all` support for the 21-category sweep.
- Fixed exact shoe model drift:
  - `Converse x Carhartt WIP One Star` no longer collapses into generic `converse_one_star`.
  - Added exact comparable-key overrides for Carhartt x Converse One Star, Chuck 70, and Jack Purcell.
- Fixed New Balance collab sample pollution:
  - Auralee shoe SKU now rejects cap/hat wording.
  - JJJJound shoe SKUs now reject Joe Freshgoods and Aime Leon Dore keyword pollution.
- Made SKU safety reporting stricter and less misleading:
  - Invalidated pool keys are no longer counted as active sample pollution for SKU safety grading.
  - Only active ready/reserved pool rows can make a SKU look publicly polluted.

## DB Mutations Applied
- Fashion stale/key cleanup:
  - 6 fashion rows were processed after current parser comparison.
  - 5 stale raw SKU rows were refreshed while preserving safe ready exposure.
  - 1 Carhartt Converse One Star row changed comparable key and was invalidated/re-scored through the normal path.
- Shoe pollution cleanup:
  - 2 New Balance collab pollution rows were invalidated from active pool exposure.
  - 1 Auralee cap parsed sample row was reclassified so it no longer contributes a shoe comparable key.
- Electronics/runtime-readiness correction:
  - An initial all-category cleanup pass was too conservative because it relied on stale code readiness constants.
  - Scoring was already using DB readiness, so smartphone/tablet/laptop-style rows were allowed back by the runtime path.
  - Scripts were corrected to match runtime DB readiness before final cleanup checks.
- Drone cleanup:
  - 1 ambiguous DJI/Sony mixed-title row was invalidated after current parser/readiness check.

## Verification
- Fashion catalog regression:
  - `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 19/19 passed.
- Shoe SKU safety:
  - `readySku=72`
  - `safe_public=66`
  - `probably_safe=6`
  - `fix_now=0`
  - `watch_internal_only=190`, all shown examples had `ready=0`.
- Clothing SKU safety:
  - `readySku=47`
  - `safe_public=35`
  - `probably_safe=12`
  - `fix_now=0`
  - `watch_internal_only=79`, all shown examples had `ready=0`.
- All-category runtime cleanup dry-run:
  - `scannedPoolRows=506`
  - `candidateRows=0`
  - `invalidatePoolRows=0`
  - `reclassifyRows=0`
  - `rejectRows=0`
- All-category funnel snapshot:
  - `categories=21`
  - `rawRows=86366`
  - `parsedRows=115164`
  - `poolRows=6502`
  - ready counts in the funnel included shoe `140`, clothing `139`, smartphone `33`, tablet `31`, earphone `66`, laptop `9`, smartwatch `27`, sport_golf `4`, game_console `5`, drone `22`.

## Deferred / Follow-Up
- Parser-version mismatch backlog remains large in old parsed rows, especially shoe/clothing/electronics, but the final active ready/reserved cleanup check showed no current-catalog/actionable exposure.
- Broad shoe and clothing SKUs with no active ready rows remain watch/internal-only until exact model/silhouette evidence is strong enough.
- DB readiness notes for some electronics categories still read like "learning only" while the DB status is `ready`; this should be reconciled later, but runtime and cleanup now consistently follow the DB status field.
- Continue batch-based SKU creation only when the new raw/pool evidence shows a repeatable model axis, not one-off noisy titles.
