# 2026-05-21 Wave462 — Shoe second chunk audit

## Context

- Continued active shoe `currentDiff` sweep after Wave461 cleared the first 2,500-row sample.
- Audited the next 2,500 active `shoe-*` rows using `START_OFFSET=2500`.

## Decisions

- Fixed normal Asics Jog 100 variants instead of clearing them:
  - Added `Jog 100S`, `Jog 100T`, and Korean glued forms (`조그100S`, `조그100T`) to `shoe-asics-jog-100`.
  - This removed the largest observed drift group from the second chunk (`currentDiff=24` before fix).
- Fixed Asics Gel Nimbus glued Korean notation:
  - Added `젤님버스` to `shoe-asics-gel-nimbus`.
- Did not bulk-clear the remaining second-chunk rows yet.
  - Remaining examples include Bape Sta collabs, Crocs collabs, Dior B-series description-noise rows, and one-off Converse/Crocs/Birkenstock/Balenciaga cases.
  - These should be handled in a follow-up wave with either explicit narrow lanes or conservative stale clears.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 164 pass, 0 fail.
- Second-chunk audit after Jog 100 fix:
  - Top drift changed from `shoe-asics-jog-100 currentDiff=24` to Bape/Crocs/Dior small groups.

## Deferred

- Apply cleanup for remaining Wave462 second-chunk drift groups.
- Investigate Dior B25/B30/B57 rows: likely normal listings blocked by description noise, so they should not be cleared without a focused parser check.
