# 2026-05-25 Wave863 shoe small exact and broad audit

## Context
- Continued the shoe deep-sweep after Wave862.
- Targeted the next unprocessed lower-volume watch/internal-only lanes:
  - `shoe-converse-chuck70-white`
  - `shoe-hoka-bondi-7`
  - `shoe-newbalance-725-broad`
  - `shoe-newbalance-740-broad`
  - `shoe-acne-triplo`
  - `shoe-newbalance-1080-broad`
  - `shoe-onrunning-cloudtilt-mainline`
  - `shoe-salomon-x-ultra-broad`
  - `shoe-y3-qasa-broad`
  - `shoe-asics-gel-1130-cream-white`

## Decisions
- Restored exact public lanes for normal Converse Chuck 70 White and Hoka Bondi 7 rows.
- Added Converse Chuck 70 White variant blockers:
  - Mission-V / 미션V
  - AT-CX / ATCX
  - Sketch White / 스케치화이트
  - White Pack / 화이트팩
  - Color Change / 컬러체인지
  - Isabel Marant / 이자벨마랑
- Kept Asics Gel-1130 Cream White from absorbing Atmos/Ohos collaboration rows. The sampled Ohos rows are premium 225K-700K and must not price against normal Gel-1130 Cream White.
- Kept NB725/NB740/NB1080/Y-3 Qasa/Salomon X Ultra broad lanes as internal/watch lanes unless later exact splits prove enough depth.
- Preserved exchange/trade rejection: pid `400396406` looked like a normal Converse Chuck 70 White title, but description included `교신도 환영합니다`, so existing exchange-listing policy correctly rejected it.

## Applied Result
- Final reclassify dry-run and apply matched:
  - scanned parsed rows: 121
  - candidate rows: 42
  - reclassified rows: 0
  - refreshed rows: 27
  - rejected rows: 15
- Key restored rows:
  - Converse Chuck 70 White normal classic rows refreshed to `shoe-converse-chuck70-white`.
  - Hoka Bondi 7 rows refreshed to `shoe-hoka-bondi-7`, including W/wide/BBLC wording.
- Key rejected rows:
  - Converse Mission-V, ATCX, Sketch White, Isabel Marant, White Pack Color Change variants.
  - Asics x Atmos x Ohos Gel-1130 RE rows from stale `shoe-asics-gel-1130-cream-white`.
  - Acne Triplo row with exchange wording.
- Market staging completed after apply:
  - queued: 41
  - enriched: 41
  - scored: 946
  - upserted: 172
  - pool upserted: 947
  - reveal current profit updated: 2
  - reveal current profit invalidated: 0
- Gate cleanup after staging found 0 remaining candidates.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts` passed: 61/61.
- Latest shoe safety:
  - catalog SKU: 641
  - non-empty SKU: 503
  - ready SKU: 83
  - ready safe public: 81
  - ready probably safe: 2
  - fix-now: 0
- Latest clothing safety:
  - catalog SKU: 260
  - non-empty SKU: 248
  - ready SKU: 49
  - ready safe public: 41
  - ready probably safe: 8
  - fix-now: 0

## Deferred
- Converse Chuck 70 special variants need their own child SKUs only if future raw volume justifies it.
- Asics x Ohos/Atmos Gel-1130 should remain blocked/null until a dedicated premium collab SKU has enough clean sample depth.
- Continue with the next unprocessed shoe watch/internal-only lanes before switching to clothing broad lanes.
