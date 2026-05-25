# 2026-05-24 Wave 805 - Systemic Cross-Category Reinforcement

## Context
- User explicitly rejected one-off keyword fixes and asked for a systematic review across clothing, shoes, golf, game consoles, and comparable matching quality.
- Goal for this wave: separate immediately visible pool safety from broader historical DB debt, then apply only low-risk repairs.

## Decisions
- Treat `ready`/`reserved` candidate-pool correctness as the first safety boundary.
  - After current-reparse cleanup, active pool scan covered 117 rows.
  - `candidateRows=0`, `poolActionableRows=0`.
- Do not blanket-reparse the full DB.
  - Full sweep audited 44,038 parsed rows.
  - Historical/actionable debt is still large (`actionableRows=24,808`), but many rows require SKU/category/key migration rather than a blind write.
- Add a safe tier-only backfill path for game/golf rows.
  - Script: `scripts/apply-cross-category-tier-backfill-batch.ts`.
  - It only applies when raw SKU, current SKU, category, and comparable key are stable.
  - It skips active pool by default.
  - It now skips console bundle axes, console special/variant axes, and new `reject` condition tiers unless explicitly requested.
- Apply capped safe backfill only after sample review.
  - First capped batch applied 516 non-active rows: `game_console=421`, `sport_golf=95`.
  - Second hardened batch applied 93 non-active game-console rows: `a_grade=38`, `c_grade=33`, `b_grade=18`, `s_grade=4`.
  - Total safe tier backfill applied in this wave: 609 rows.
- Strengthen catalog gates where the sweep exposed systemic leakage.
  - Game-title catalog now rejects character goods/printed merch such as 장패드, 잡지, 핸드타월, 쿠지, 아크릴/뱃지.
  - Switch body lanes now reject uncovered game-title rows such as 호그와트, 라보/토이콘, 디지몬, 동키콩 리턴즈, 피크민, 드래곤퀘스트, 저스트댄스, 나루토, 소닉.
  - PS5 body matching now pins strong standard-disc body listings while excluding slim/pro, disc-drive-only, and game-title/disc listings.
  - PS5 slim disc lane rejects disc-drive-only accessory rows.

## Verification
- Tests passed:
  - `npx tsx --test tests/cross-category-deepsweep-regression.test.ts tests/fashion-catalog-regression.test.ts`
  - 10 passed, 0 failed.
- Active-pool cleanup dry-run after backfill:
  - `scannedPoolRows=117`
  - `candidateRows=0`
  - `invalidatePoolRows=0`
  - `reclassifyRows=0`
  - `rejectRows=0`
  - `refreshRows=0`
- Full DB sweep after backfill:
  - `auditedRows=44038`
  - `flaggedRows=27915`
  - `actionableRows=24808`
  - `poolRowsReadyOrReserved=117`
  - `poolActionableRows=0`

## Deferred Work
- Fashion/shoe historical parsed rows still need a dedicated migration, not a broad update.
  - Top remaining debt: `fashion_missing_condition_tier=14445`, `fashion_key_tier_differs_from_condition_tier=9244`.
  - Many clothing/shoe rows have stale comparable keys from older parser versions.
- Golf rows need a separate axis plan.
  - Current sweep still shows golf key drift and broad rows involving generation, loft, shaft, club type, and occasional cross-category contamination.
- Game console historical rows need bundle/variant axes.
  - Remaining examples include Switch OLED special editions, bundled games/chips, and Switch v1 rows that are actually game titles.
  - These should be reclassified or split into bundle/variant lanes rather than tier-backfilled.
- First safe tier batch included non-active `reject` tier rows before the script was hardened.
  - No active pool impact was found.
  - A later audit should inspect historical `game_console`/`sport_golf` `condition_tier=reject` rows and clear false rejects only with explicit evidence.

## Next Step
- Build a dedicated historical migration planner that produces separate queues:
  - active-pool cleanup,
  - safe tier-only backfill,
  - SKU/category reclassification,
  - bundle/variant-axis hold,
  - fashion/shoe condition-key resync.
