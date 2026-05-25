# 2026-05-25 Wave 811 Shoe Exact-Axis Promotion

## Context
- Shoe sample QA after Wave 809/810 showed broad Kayano and football/futsal SKUs were still too coarse for public sample matching.
- The risky pattern was not just one SKU: Asics Gel-Kayano generations/collabs, Adidas football sub-lines, and Puma football/lifestyle substring leaks needed deterministic separation.

## Decisions
- Promoted only explicit high-volume shoe axes to public-ready lanes:
  - `shoe-asics-gel-kayano-14`
  - `shoe-adidas-football-f50`
  - `shoe-adidas-football-predator`
  - `shoe-adidas-football-copa`
  - `shoe-puma-football-ultra`
  - `shoe-puma-football-future`
  - `shoe-puma-football-king`
- Kept learning/uncertain lanes internal-only:
  - broad `shoe-asics-gel-kayano`, `shoe-adidas-football`, `shoe-puma-football`
  - Kayano 28/31/32 exact lanes until pool sample QA proves public safety.
- Blocked known public-sample pollution:
  - Kayano14 collabs/special lines: Unaffected, APC, Atmos/Under My Car, Museum Visitor, Unlimited, Musinsa limited, etc.
  - Adidas football special lines: Beckham, Gosha, youth/junior, launch/advancement packs, Messi/Son/signature/limited.
  - Puma football special/lifestyle leaks: Neymar/World Cup, Pulisic/limited, launch/creativity packs, Court Ultra, Cell Dome King, Future Cat, jerseys/marking, Lafuma trekking.
- Updated shoe safety report broad detection so exact football lanes are not falsely marked as broad while deterministic pollution checks still apply.

## DB Backfill
- Applied Wave 811 exact-axis cleanup:
  - First apply: scanned 1,538 target rows, changed 1,281.
  - Reclassified 887 rows to current exact SKU/key, held 376 internal-only, rejected 18 false matches.
  - Ready/reserved invalidation during first apply: 0.
- Follow-up cleanup after score QA:
  - scanned 633 remaining broad rows, changed 376.
  - held 365 internal-only, rejected 11 Puma special/lifestyle rows.
  - invalidated 1 ready broad row (`shoe-puma-football` Neymar/World Cup pollution).
- Ran market stats and score stages after backfill:
  - market stats stage: scored 2,654, pool upserted 2,605.
  - score stage pass 1: scored 785, pool upserted 49.
  - score stage pass 2: scored 1,017, pool upserted 40.

## Verification
- Targeted tests passed:
  - `npx tsx --test --test-name-pattern "recent pool sweep|shoe broad|shoe sample safety" tests/core-rules.test.ts`
- Latest shoe safety report:
  - `fixNow=0`
  - ready SKU grades: `safe_public=65`, `probably_safe=4`, `watch_internal_only=0`
- Candidate pool count after verification:
  - `ready=485`, `invalidated=5884`, `spent=21`, `reserved=0`

## Deferred
- Some exact shoe rows still have `score_dirty=true`; the regular score pipeline will continue to process them. This is throughput, not a catalog-safety blocker.
- Broad/high-volume shoe families still need future exact splitting before public-ready use: New Balance 327/574/530, Gucci broad, Converse broad, Adidas Tobacco/Superstar, Nike Mercurial/Tiempo/Dunk broad, Prada/Dior/LV/Hermes broad.
- Clothing should use the same pattern next: inspect ready sample pollution first, promote only explicit axes, hold broad/collab/variant lanes internal-only, then backfill and verify with a clothing safety report.
