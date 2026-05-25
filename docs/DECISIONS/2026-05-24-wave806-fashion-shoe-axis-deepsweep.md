# 2026-05-24 Wave 806 Fashion/Shoe Axis Deep Sweep

## Context

사용자가 콘솔보다 의류/신발 분류가 문제라고 정정했다. 특히 Arc'teryx Atom/Beta/Proton, Stussy hoodie/zip/crewneck, BAPE/Acne/Hoka/Samba 같은 ready/sample 비교군 혼입을 지적했다.

## Decisions

- 콘솔 쪽 작업은 이번 wave의 중심이 아니므로 의류/신발 카탈로그와 DB cleanup으로 전환했다.
- Arc'teryx는 brand/model broad를 더 키우지 않고 가격이 갈리는 명시 sub-line만 strict lane으로 분리했다.
  - Atom LT Hoody
  - Atom LT Jacket non-hood
  - Atom SL
  - Atom AR / Heavyweight
  - Beta LT / SL / AR
  - Proton LT / FL / SV / AR
- Atom LT처럼 sub-line은 있으나 hood/non-hood 축이 없는 행은 broad Atom으로 흡수하지 않고 reject/AI L2 후보로 남긴다.
- Stussy는 pullover hoodie, zip hoodie, crewneck/sweatshirt를 분리했다.
- Stussy x Nike shoe broad는 계속 blocked로 두고 Air Penny 2만 narrow ready lane으로 추가했다.
- Acne 1992m/2003 denim은 기존 premium denim 주석과 다르게 mustContain에 빠져 있어 premium lane으로 보강했다.
- Nike Air Max 95 generic은 Carhartt/WIP collab 표기(`칼하트`, `wip`)를 흡수하지 않도록 차단했다.
- 추가 shoe pass에서 UGG Classic broad를 더 이상 만능 fallback으로 두지 않고 명시 silhouette별로 split했다.
  - Classic Short / Short II / Short Weather Hybrid
  - Classic Mini / Mini II / Classic Mini Platform / Classic Mini Dipper
  - Classic Ultra Mini / Ultra Mini Platform / Ultra Mini New Heights / Classic Clear Mini
  - Classic Tall
  - Tasman / Neumel / Disquette
- UGG broad에서 Ozwear/일반 퍼부츠/하트·밍크·플랫폼 변형이 섞이는 구조를 차단했다.
- Dior B23 / Hermes Izmir / LV Run Away active rows는 lane readiness가 아직 열려 있지 않은 high-end shoes라서 ready로 승격하지 않고 pool에서 invalidated 처리했다.
- Adidas football은 새 SKU가 필요한 문제가 아니라 parser가 이미 F50/Predator/Copa/X Crazyfast와 TF/FG/AG-MG 축을 만들 수 있는데 과거 key가 stale한 문제로 판단해 targeted backfill을 적용했다.
- 추가 active sample audit에서 Asics Kiko / Gel-Quantum / Puma Nitro / Mizuno Wave Prophecy / Converse x Carhartt WIP가 broad ready lane 안에서 실제 모델 가격축을 섞는 것으로 판단했다.
  - 정확 모델명이 있는 lane은 ready로 신설한다.
  - 모델명이 애매한 broad family/collab lane은 blocked로 내려 신규 유입을 보수적으로 막는다.
- Arc'teryx Veilance, Polo RRL denim은 "맛/st/스타일/비교 브랜드" 표현을 본품으로 보지 않는 reference-only veto를 추가했다.

## DB Actions Applied

- active clothing/shoe ready/reserved cleanup:
  - first apply: 120 rows scanned, 12 candidates, 8 reclassify, 4 refresh, 12 pool invalidations.
  - final cleanup: 1 Salomon shoe stale key refresh, 1 pool invalidation.
- targeted historical reclassify for old Arc'teryx/Stussy/Stussy-Nike keys:
  - 758 parsed rows scanned, 617 candidates applied.
  - 397 reclassify, 207 parsed-key refresh, 13 reject.
- remaining sample cleanup for Hoka Satisfy, BAPE hoodie zip, Wales Bonner Samba, Air Max 95, Acne denim:
  - 119 parsed rows scanned, 33 candidates applied.
  - 1 reclassify, 27 parsed-key refresh, 5 reject.
- residual Arc old-key refresh:
  - 65 parsed rows scanned, 12 refresh applied.
- Air Max 95 Carhartt/WIP cleanup:
  - 31 parsed rows scanned, 1 reject applied.
- UGG Classic broad targeted cleanup:
  - dry-run: 103 parsed rows scanned, 91 candidates.
  - apply: 69 reclassify into UGG narrow lanes, 22 reject from UGG broad.
  - verify dry-run: 12 parsed rows scanned, 0 candidates.
- shoe gate cleanup:
  - 41 active shoe pool rows scanned, 5 candidates applied.
  - Dior B23 / Hermes Izmir / LV Run Away rows refreshed and invalidated because lane readiness is still blocked.
- Adidas football targeted parser-key backfill:
  - 47 parsed rows scanned, 46 candidates applied.
  - 45 parsed-key refresh into submodel/surface keys, 1 reject (`가격제안` row).
  - verify dry-run: 1 parsed row scanned, 0 candidates.
- Wave 806 active shoe broad-axis split:
  - 7 active ready/reserved rows scanned as candidates, 7 applied.
  - 6 reclassified from broad to exact lanes:
    - Asics Kiko Gel-Kiril
    - Asics Gel-Nimbus 9
    - Asics Gel-Quantum 360
    - Mizuno Wave Prophecy MOC (A/B grade rows)
    - Converse x Carhartt WIP One Star
  - 1 ambiguous Puma Nitro broad row invalidated because explicit Deviate/Velocity/Elite model token was absent.
- FOG Essentials brand guard cleanup:
  - 1 active ready clothing row rejected/current-catalog invalidated because the title only said "에센셜" without FOG/Fear of God brand signal.
- Historical sample cleanup for reference-only fashion phrases:
  - 22 parsed rows scanned across Veilance and RRL denim b-grade keys.
  - 4 reject (`베일런스 맛`, `베일런스 st`, `RRL&LVC&폴로` comparison, `더블알엘 맛`).
  - 6 valid rows refreshed to current condition comparable keys.

## Verification

- Regression tests:
  - `npx tsx --test tests/fashion-catalog-regression.test.ts tests/cross-category-deepsweep-regression.test.ts`
  - 19 tests passed after Wave 806 shoe split additions.
- Active ready/reserved cleanup dry-run after apply:
  - 110 rows scanned, 0 candidates.
- Targeted historical key dry-runs after apply:
  - Arc/Stussy/AirMax checked keys all 0 candidates.
- Fashion ready pool systemic audit final after active shoe split/reference cleanup:
  - activePoolRows: 112
  - rowActionableRows: 0
  - groupActionableGroups: 0
- Clothing/shoe DB deep sweep after Wave 806 cleanup:
  - auditedRows: 40,969
  - actionableRows: 22,247
  - poolRowsReadyOrReserved: 109
  - poolActionableRows: 0

## Deferred

- Full historical DB backfill is still large and should be batched separately. Top remaining historical groups include Nike Dunk Low broad, Polo unknown-condition keys, Stussy basic tee historical drift, Polo Oxford shirt, Moncler broad, TNF Nuptse, and RRL broad.
- BAPE Baby Milo and Hoka Satisfy non-Mafate rows were rejected from existing sample keys rather than promoted to new ready lanes. New lanes need sample-backed mining before release.
- Wales Bonner typo `Wales Boner` was rejected from the existing sample key for now. If future live listings show the typo is common, add it as a guarded alias.
- Remaining high-spread active sample groups such as Hoka Satisfy Mafate colorways, Asics Kiko one-off submodels, Acne broad garment groups, BAPE tees/crewnecks, and Adidas trefoil jackets still need separate sample-backed mining. They are not row-actionable in the current pool, but broad spread should be reviewed before promoting more broad lanes.
