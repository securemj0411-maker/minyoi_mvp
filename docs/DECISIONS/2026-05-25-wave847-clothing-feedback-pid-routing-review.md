# Wave 847 — Clothing feedback PID current-routing review

## Context

User asked to keep reading operator/debug comments and latest pool/raw rows, especially cases where sample comparison items attach to the wrong clothing or shoe SKU. This wave targeted high-feedback clothing PIDs from the latest safety report rather than only recent ready rows.

## Decision

Use current catalog routing as the source of truth for the selected feedback PIDs, but apply only after a dry-run and regression guard. The first dry-run exposed a new leak:

- `로어즈 Striped Cotton Pique Polo` was being routed into `clothing-polo-pique-classic` because English `Pique Polo` used `polo` as a garment word.

Fix applied before DB writes:

- Added `로어즈` / `loars` blockers to `clothing-polo-pique-classic`.
- Added regression coverage so Loars English/Korean titles cannot enter Polo Ralph Lauren pique.

## Applied changes

Command:

```bash
npx tsx scripts/apply-fashion-current-catalog-reclassify.ts --pids=391276760,395757345,395364818,368074395,325358167,409748762,343462169,379696762,392555021,398190699,402789240,364298270,375866323,382991321,383431989,403477522,407966767,400862087,332151960,407160018,403560772,341198591,406145317,409058862,7001361235005,409066831,409185377,388821118,403876214,369788712,398060575,349656136,308970257,404593839,385621739,355475857,406382348,408202266,384330007 --reason=wave847_clothing_feedback_pid_current_routing_review --apply
```

Result:

- scannedParsedRows: 39
- rawRows: 39
- candidateRows: 10
- reclassifyRows: 3
- refreshParsedRows: 3
- rejectRows: 4

Notable routing:

- `clothing-tnf-nuptse-broad -> clothing-tnf-white-label-novelty`
- `UNIQLOxEG Dry Pique Striped Polo Shirt -> clothing-uniqlo-broad` (broad/internal, not public-ready)
- `FOG Essentials longsleeve polo -> clothing-fog-essentials`
- `BAPE APEE BABY tee -> null`
- `Polo Big Pony USA flag PK -> null`
- `Polo pique dress -> null`
- `Loars Pique Polo -> null`

## Post-apply verification

- Regression: `npx tsx --test tests/fashion-catalog-regression.test.ts` passed 44/44.
- Stage: queued 25, poolUpserted 1248, reveal_current_profit_updated 21, reveal_current_profit_invalidated 6.
- Gate cleanup: 3 shoe rows invalidated, 0 clothing rows.
- Clothing safety: readySku 46, safe_public 38, probably_safe 8, fix_now 0.
- Shoe safety: readySku 70, safe_public 67, probably_safe 3, fix_now 0.

## Deferred

- Broad clothing lanes with large eligible counts remain internal-only until they can be split or proven by clean samples.
- `clothing-uniqlo-broad` and similar broad rows may help future learning/backfill, but must not be made public-ready without SKU-level split evidence.
