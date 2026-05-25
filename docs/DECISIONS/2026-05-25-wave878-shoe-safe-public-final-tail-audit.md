# 2026-05-25 Wave878 Shoe Safe Public Final Tail Audit

## Scope
- Audited the remaining shoe safe-public tail SKUs:
  LV Runaway, ADER Converse, Jordan 11, NB 550, Hoka Anacapa, NB JJJJound, Supreme Nike SB, On Cloudmonster, Dr. Martens, Puma Rose Speedcat, Nike Cortez Union, Polo loafers, Salomon RX Slide, Ambush AF1, Birkenstock Milano, Feng Chen Wang Converse, Travis Air Max 1, NB Thisisneverthat, Crocs Anderson Bell, NB Salehe, Jordan 1 Zoom Comfort.

## Decisions
- Fixed Converse collab vs generic Chuck 70 ambiguity.
  - Added ADER ERROR and Feng Chen Wang tokens to the Chuck 70 generic collab blocker.
  - Normal ADER/Feng Chen Wang Converse rows now stay in their collab SKUs instead of falling to null.
- Fixed Supreme Nike SB exact-axis collision.
  - Explicit `Dunk Low` rows now route to `shoe-nike-dunk-low-supreme` instead of the broader Supreme Nike SB bucket.
- Fixed NB ALD rows polluted by hashtag bait.
  - Direct ALD matching now ignores hashtag text for other-collab blocker checks, so main-title `에임레온도르` rows with `#자운드...` hashtags route to ALD.
  - Main-title Joe Freshgoods/JJJJound/Kith/etc. blockers remain active.

## Applied Result
- Final dry-run: scanned 788, candidates 85, reclassify 8, refresh 77, reject 0.
- Apply: scanned 788, candidates 85, reclassify 8, refresh 77, reject 0.
- Stage: queued 93, enriched 93, scored 1,876, poolUpserted 1,889.
- Cleanup: candidate 0.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts`: 70 passed.
- Shoe safety: fixNow 0, readySku 85, safe_public 82, probably_safe 3.
- Clothing safety: fixNow 0, readySku 51, safe_public 43, probably_safe 8.

## Deferred
- Broad shoe buckets such as NB 327, Gucci, Chuck 70 High, Adidas Tobacco, Prada, NB 574, and Nike Shox remain watch_internal_only with ready 0. They should stay internal-only until explicit model/color/collab splits prove safe.
