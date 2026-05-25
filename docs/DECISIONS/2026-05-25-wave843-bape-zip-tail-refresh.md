# 2026-05-25 Wave843 — BAPE Zip Hoodie Tail Refresh

## Context
- User asked to keep sweeping clothing/shoe ready samples, not just a single brand.
- After Wave831 BAPE hoodie/zip blockers, I rechecked the remaining BAPE zip hoodie tail to make sure new raw rows would not keep stale comparable keys.

## Decision
- Do not create a new SKU in this wave.
- Keep `clothing-bape-hoodie-zip` public-ready for explicit full-zip/zip hoodie wording.
- Treat this wave as DB parsed-key refresh only: the current catalog already routes the checked rows to the same SKU.

## Apply Result
- Command scope: BAPE zip/hoodie/broad comparable keys.
- `scannedParsedRows`: 119
- `candidateRows`: 4
- `reclassifyRows`: 0
- `refreshParsedRows`: 4
- `rejectRows`: 0

Representative refreshed rows:
- `7001669896923` — `희귀!! 베이프 밀로 올드스쿨 캔디 카모 투 웨이 후드집업 XL`
- `405977263` — `베이프 후드집업`
- `409200967` — `베이프 청계 타이거 후드집업`
- `408689574` — `베이프 청계 반카모 후드집업`

## Deferred
- `clothing-bape-hoodie-zip` remains `probably_safe` because it still has historical feedback and only 2 current ready rows.
- Further split is deferred until more raw rows reveal a repeatable axis such as Shark/full-zip/Milo/special-camo with enough sample density.

