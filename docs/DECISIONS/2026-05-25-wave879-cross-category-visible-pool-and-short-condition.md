# 2026-05-25 Wave879 Cross Category Visible Pool And Short Condition

## Scope
- Investigated the latest clothing, shoe, golf, and game console pool/readiness drift after broad category work.
- Focused on visible pool safety first, then current parser/catalog consistency for recently ready/raw rows.

## Decisions
- Added global fashion lookalike blockers for Sacai-style phrasing.
  - `사카이 맛`, `sacai 맛`, `sakai 맛`, and style variants now block `shoe-nike-sakai-collab`.
  - This prevents taste/lookalike listings such as Nike Waffle One from attaching to real Sacai sample groups.
- Fixed short-title condition grading for shoes and clothing.
  - Short listings with explicit condition terms now grade from those signals instead of falling back to `UNKNOWN`.
  - Added explicit short positive shoe tokens such as `새상품`, `새제품`, `새신발`, `새거`, and `민트급`.
- Extended current reclassify tooling to refresh `condition_tier` drift even when the comparable SKU key stays the same.
  - This catches rows where the SKU is correct but the pool key should move from B/UNKNOWN to A/S after condition parser improvements.
- Extended ready recovery to treat `wave804_parsed_key_drift` as recoverable.
  - Visible rows invalidated by current-reparse cleanup are now re-promoted when the rebuilt key is current-safe.

## Applied Result
- Targeted current reclassify for six suspicious rows:
  - candidates 5, reclassify 2, refresh 2, reject 1.
  - Rejected one Sacai-lookalike Waffle One row.
  - Refreshed Yeezy 350 and Nike Air Max 95 short-condition rows to A-grade.
  - Routed CDG Homme Plus tee and CDG Homme wrinkle jacket to narrower current SKUs.
- Stage after targeted apply:
  - queued 58, enriched 58, scored 1,800, poolUpserted 1,590.
- Visible pool current-reparse cleanup:
  - scannedPoolRows 332, candidates 18, refresh 18, invalidatePoolRows 18.
  - Mostly shoe rows whose visible key improved after explicit short-condition parsing, plus one Stussy hoodie condition refresh.
- Stage after visible cleanup:
  - queued 11, enriched 11, scored 285, poolUpserted 298.
- Recovery after adding `wave804_parsed_key_drift`:
  - recoverable 18, eligible 18, applied 18.
  - currentReadyAfterRun 536, shoe ready 177, clothing ready 145.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts`: 71 passed.
- Visible pool current-reparse cleanup dry-run: candidateRows 0.
- Fashion pool gate-blocked cleanup dry-run: candidateRows 0.
- Shoe safety: fixNow 0, readySku 85, safe_public 82, probably_safe 3.
- Clothing safety: fixNow 0, readySku 51, safe_public 43, probably_safe 8.

## Deferred
- Latest no-pool current replay still has 22 actionable rows to process in a separate batch.
  - Most are safe condition-tier/key refreshes or raw SKU drift rows not currently visible in pool.
  - One CDG blazer row has UNKNOWN condition tier but a C-grade key and should be reviewed separately before changing fallback behavior.
