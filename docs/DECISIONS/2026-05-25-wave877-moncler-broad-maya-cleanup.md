# 2026-05-25 Wave877 Moncler Broad Maya Cleanup

## Scope
- Follow-up from the clothing safety report after Wave876.
- `clothing-moncler-broad` surfaced as fix_now because one ready row still belonged to broad while the current deterministic catalog routes it to Maya.

## Decision
- Reclassified pid `388169967` (`[4] 몽클레어 마야70 오렌지 컬러 패딩`) from `clothing-moncler-broad` to `clothing-moncler-maya`.
- No catalog rule change was needed. The current rule already identified Maya correctly.

## Applied Result
- Dry-run: scanned 1, candidate 1, reclassify 1, reject 0.
- Apply: scanned 1, candidate 1, reclassify 1, reject 0.
- Stage: queued 21, enriched 21, scored 585, poolUpserted 483.
- Cleanup: candidate 0.

## Verification
- Clothing safety: fixNow 0, readySku 51, safe_public 43, probably_safe 8.
- Shoe safety: fixNow 0, readySku 85, safe_public 83, probably_safe 2.

## Deferred
- `clothing-moncler-broad` remains watch_internal_only with ready 0 and eligible 345. It should stay internal-only until product-axis splits prove clean enough for public release.
