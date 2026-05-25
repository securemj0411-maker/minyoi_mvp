# Wave 815 Shoe Ready Sample Pollution Cleanup

Date: 2026-05-25

## Context
- After Wave 814, active ready/reserved exposure was clean at the current-catalog gate level, but the user specifically called out weird shoe sample comparables.
- A limited ready-pool sample-group audit was run on the top 25 shoe/clothing comparable groups.
- The audit found no clothing sample group requiring immediate action, but three shoe sample-group problems were real.

## Findings
- New Balance JJJJound:
  - One stale sample row still had `shoe|newbalance_jjjjound_collab|sneaker|a_grade`.
  - The title was actually an Aime Leon Dore 860 row with JJJJound hashtag stuffing.
- Nike SB Dunk Low Travis Scott:
  - `BapeStar Apestation by Indigo Studio` was incorrectly matching Travis SB Dunk because the title contained enough noisy sneaker/collab wording.
  - A title-stuffed `Golden Gals / Metallic Silver / Chicago / Travis Scott` Dunk row also matched the Travis SB Dunk lane.
- Nike x CDG broad collab:
  - The broad `cdg_nike_collab` lane mixed Dunk, Pegasus, Terminator, Talaria, Foamposite, Tennis Classic, and vague Nike CDG rows.
  - Sample spread was about 10x in the audited group (`70k` to `720k`), so this is not safe as a public ready comparable key.

## Decisions / Changes
- Blocked `cdg_nike_collab` in `LANE_READINESS`.
  - It remains parsable/cataloged, but cannot enter the public pool until exact model lanes are split and audited.
- Tightened Travis SB Dunk catalog matching.
  - Added must-not tokens for BAPE/Apestation/Indigo Studio/Skull Sta.
  - Added must-not tokens for title-stuffed non-Travis Dunk signals such as Chicago, Golden Gals, and Metallic Silver.
- Kept New Balance JJJJound rules from Wave 814, then cleaned the remaining stale sample row.
- Added regression coverage for:
  - BAPE/Apestation rejecting Travis SB Dunk.
  - title-stuffed non-Travis Dunk rejecting Travis SB Dunk.
  - true Travis SB Dunk still matching.
  - CDG Nike broad still parsing but failing the public pool gate.

## DB Mutations Applied
- Public pool:
  - Invalidated 2 active `shoe-cdg-nike-collab` ready rows after the lane was blocked.
  - Reason: `wave815_cdg_nike_broad_lane_hold`.
- Parsed/raw sample cleanup:
  - Rejected 4 stale sample rows from their old comparable keys.
  - PIDs:
    - `388672199` — ALD 860 hashtag stuffing in JJJJound sample.
    - `404876523` — BapeStar/Apestation false Travis match.
    - `187783695` — non-Travis Dunk title stuffing false Travis match.
    - `383669887` — CDG Nike Terminator broad-row sample removed while the broad lane is held.
- Pipeline refresh:
  - Market stage ran once with limit `1000`; `timedOut=false`.
  - Score stage ran once with limit `800`, budget `90000ms`; `timedOut=false`.
  - Fraud hash loading timed out once during score but was logged as non-fatal by the pipeline.

## Verification
- Regression:
  - `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 20/20 passed.
- Ready sample-group audit:
  - Before cleanup: `groupActionableGroups=3`.
  - After cleanup: `groupActionableGroups=0`.
- Shoe SKU safety:
  - `readySku=71`
  - `safe_public=65`
  - `probably_safe=6`
  - `fix_now=0`
- Clothing SKU safety:
  - `readySku=47`
  - `safe_public=35`
  - `probably_safe=12`
  - `fix_now=0`
- All-category current reparse cleanup dry-run:
  - `scannedPoolRows=517`
  - `candidateRows=0`
  - `invalidatePoolRows=0`
  - `reclassifyRows=0`
  - `rejectRows=0`
- Funnel snapshot:
  - `rawRows=86474`
  - `parsedRows=115287`
  - `poolRows=6510`
  - ready counts included shoe `139`, clothing `139`, smartphone `42`, tablet `34`, earphone `67`, smartwatch `27`.

## Deferred / Follow-Up
- CDG Nike exact lanes should be split only after model-specific evidence:
  - Dunk Low, Terminator High, Pegasus, Tennis Classic, Talaria, Foamposite, and maybe Classic SP2 are separate price axes.
  - Until then, the broad CDG Nike lane stays blocked/internal-only.
- Parser mismatch backlog is still large in old parsed rows, but final active ready/reserved cleanup showed no current actionable exposure.
- Top row-level audit flags still include a few false-positive detector warnings from descriptive text; they did not produce actionable sample-group pollution after cleanup.
