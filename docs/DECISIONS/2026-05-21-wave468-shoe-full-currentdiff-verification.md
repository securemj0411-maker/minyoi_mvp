# Wave 468 — shoe full current-diff verification

Time: 2026-05-21 11:43 KST

## Context

After chunked shoe cleanup from offsets 0-14,351, ran a full active shoe current-diff audit to catch offset-shift residue. The first full pass found two remaining Adidas Gazelle rows:

- `아디다스 가젤 볼드 트루핑크 (230)` was still assigned to `shoe-adidas-gazelle-og-broad`.
- `아디다스 비치 가젤 슬리퍼` was still assigned to `shoe-adidas-gazelle-og-broad`.

Both are distinct from Gazelle OG comparables and were already blocked by the parser after Wave 467.

## Decisions

1. Clear the remaining Gazelle stale rows from the active comparable pool.
   - Gazelle Bold is a distinct demand lane, not plain Gazelle OG.
   - Gazelle Beach sandal/slide is a different product shape and should not enter Gazelle OG.

2. Treat the post-clear full active shoe audit as the checkpoint for the shoe sweep.
   - Chunk audits can miss rows after DB cleanup shifts offsets.
   - Full audit is the stronger verification before moving to the next category/wave.

## Applied

- DB: cleared 2 active stale rows from `shoe-adidas-gazelle-og-broad`.
- Parser/catalog: no additional parser change in this wave beyond Wave 467's Gazelle Beach exclusion.

## Verification

- `PAGE_LIMIT=500 npx tsx scripts/wave468-shoe-full-currentdiff-audit.ts`
  - scanned 14,351 active shoe rows.
  - `groupsWithDiff=0`, `ranked=[]`.
- Latest regression suite from Wave 467:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 165 passed, 0 failed.

## Deferred

- Size/turnover bucketing remains deferred for a separate wave.
- Next cleanup candidate: non-shoe fashion active rows or catalog readiness review by highest-volume SKU family.
