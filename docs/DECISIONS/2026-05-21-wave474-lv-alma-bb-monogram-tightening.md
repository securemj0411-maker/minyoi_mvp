# Wave 474 — LV Alma BB Monogram tightening

Time: 2026-05-21 12:24 KST

## Context

After Adidas Trefoil cleanup, `bag-lv-monogram-alma-bb` was still a high drift group in the first-5,000 fashion audit.

The old rule accepted `알마 + BB` with no material signal, so several non-comparable rows were mixed into the monogram Alma BB lane:

- Material-unknown `루이비통 알마BB`
- `네오 알마BB`
- `버블그램 알마 BB`
- `알마BB 백팩`

These have different product lines, materials, and price behavior from monogram canvas Alma BB.

## Decisions

1. Require LV brand + Alma + BB + monogram/material signal.
   - Accepted signals: `모노그램`, `monogram`, `M53152`, `캔버스`, `canvas`.
   - Joined spelling such as `알마BB` is explicitly supported.

2. Block known non-comparable variants from the monogram lane.
   - `네오`, `버블그램`, `백팩`, `에삐`, `베르니`, `다미에`, `앙프렝뜨`, and PM/MM/GM size drift are excluded.

3. Clear stale rows rather than broad-migrating unclear rows.
   - Material-unknown Alma BB rows are not safe enough for monogram pricing.
   - Variant rows should not be dumped into a broad LV bag sample when the narrow candidate is known to be wrong.

## Applied

- Parser/catalog: tightened `bag-lv-monogram-alma-bb` must-contain and must-not signals.
- Parser/catalog: added `defaultProductType: "tote"` for Alma BB.
- Tests: added positive monogram Alma BB samples and negative Neo/Bubblegram/backpack/material-unknown samples.
- DB: cleared 5 active stale rows from `bag-lv-monogram-alma-bb`.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 174 passed, 0 failed.
- `npx tsx scripts/wave474-lv-alma-bb-monogram-apply.ts`
  - post-apply `totalActions=0`, `holdCount=0`.

## Deferred

- Dedicated lanes for Neo Alma BB, Bubblegram Alma BB, and Alma BB backpack are deferred until enough repeated clean sample volume exists.
