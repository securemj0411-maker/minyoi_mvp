# Wave833 Polo brand-signal and sub-line cleanup

Date: 2026-05-25

## Context

Clothing safety still showed Polo knit and Oxford shirt in `probably_safe`.
Operator feedback confirmed that "polo" as a garment word was still leaking into Polo Ralph Lauren public comparison lanes.

Observed pollutants:

- `DANCING SKELETONS ZIP POLO KNIT_WHITE`
- `유타 UTAR 골프 폴로넥 ... 니트 베스트`
- `빈폴 니트 폴로 셔츠`
- multi-brand keyword stuffing rows such as `시스템 ... 타임 ... K2 ... 폴로 랄프로렌 아미`
- `잭니클라우스 ... 폴로 니트`
- `폴로(Polo)진스` / Polo Jeans Company sub-line rows
- boys/girls and cashmere-100 premium variants

## Decision

Keep `polo_knit_sweater` and `polo_oxford_shirt` ready, but expand explicit false-brand and sub-line blockers.

- `polo_knit_sweater` now blocks newly observed non-Ralph-Lauren brands and keyword stuffing patterns.
- `polo_apparel_broad` and `polo_pony_tee` received the same false-brand blockers so blocked rows cannot leak through broad/tee side doors.
- `polo_oxford_shirt` now blocks Polo Jeans / Rugby / Lauren Ralph Lauren sub-line wording.
- `폴로(Polo)진스` punctuation variant is explicitly blocked.

## DB Backfill

Applied with `scripts/apply-fashion-current-catalog-reclassify.ts --apply`.

- scanned parsed rows: 463
- candidate rows: 66
- reclassified: 8
- refreshed parsed keys: 44
- rejected: 14

Representative changes:

- UTAR, DANCING SKELETONS, Beanpole, System/Time/K2/Ami stuffing, Jack Nicklaus, Polo Jeans, boys, cashmere-100, and Polo Jeans Company Oxford rows were removed from public comparison keys.
- Legit Polo Ralph Lauren knit rows were promoted/refreshed into `polo_knit_sweater`.
- Standard Oxford rows stayed in `polo_oxford_shirt`.

## Verification

- Direct checks:
  - false garment-brand examples -> null
  - `폴로 랄프로렌 케이블 니트 M` -> `clothing-polo-knit-sweater`
  - `폴로 랄프로렌 옥스포드 셔츠 M` -> `clothing-polo-oxford-shirt`
- `npx tsx --test tests/fashion-catalog-regression.test.ts` passed: 37/37.
- `scripts/run-market-stats-stage-once.ts` completed and upserted 963 pool rows.
- `scripts/cleanup-fashion-pool-gate-blocked.ts --apply` found 0 gate-blocked ready rows.

## Deferred

`polo_knit_sweater` and `polo_oxford_shirt` still appear as `probably_safe` because the safety report keeps historical feedback attached. Current contamination counters are clean (`currentOther=0`, `currentNull=0`), so keep them ready and continue monitoring.
