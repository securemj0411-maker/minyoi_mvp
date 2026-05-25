# Wave 875 Shoe Safe Public Lower Mid Audit

Date: 2026-05-25

## Context
- Continued shoe safe-public audit through lower-mid ready lanes.
- This wave exposed two important systemic matcher issues that can reduce valid shoe inflow or misroute collab samples.

## Scope
- Audited:
  - Nike Air Max 95, LV Trainer, Jordan 1 Low, Asics Gel Nimbus, Dior B27, Birkenstock Arizona, Hoka Hopara, CDG Salomon, NB 990v4/Kith/Auralee, Salomon RX Mary Jane, Air Max 97 Silver Bullet, Dr. Martens 1461 Quad, Hoka Bondi EG, Mizuno Wave Prophecy MOC.

## Decisions Applied
- Fixed exchange-marker parsing:
  - `교신/교환 문의시 차단` style descriptions are now treated as exchange-block notices, not exchange-request posts.
  - This prevents normal sale rows from being nulled just because sellers say they block exchange inquiries.
- Added New Balance ALD direct routing:
  - `뉴발란스 990v4 에임레온도르...` now routes to `shoe-newbalance-aime-leon-dore-collab`.
  - Other-collab/accessory bait such as Joe Freshgoods/JJJJound/Kith/Auralee/caps stays blocked.
- Applied current catalog reclassification after the fixes.

## Applied Backfill
- Command: `scripts/apply-fashion-current-catalog-reclassify.ts --reason=wave875_shoe_safe_public_lower_mid_audit --apply`
- Result:
  - scannedParsedRows: 744
  - candidateRows: 103
  - reclassifyRows: 36
  - refreshParsedRows: 67
  - rejectRows: 0

## Notable Routing
- Asics Gel Nimbus broad rows split into Nimbus 9 and Nimbus 10.1.
- Air Max 97 generic rows with Silver Bullet wording moved to `shoe-nike-airmax-97-silver-bullet`.
- Mizuno Wave Prophecy MOC rows moved out of generic Prophecy.
- NB 990v4 ALD row moved to `shoe-newbalance-aime-leon-dore-collab`.
- Jordan 1 Low Obsidian stayed in the Jordan 1 Low lane despite exchange-inquiry-blocking copy.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - pass: 68
  - fail: 0
- `npx tsx scripts/run-market-stats-stage-once.ts`
  - queued: 48
  - enriched: 48
  - scored: 1653
  - poolUpserted: 1712
  - reveal_current_profit_updated: 14
  - reveal_current_profit_invalidated: 5
- `npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --apply`
  - candidateRows: 0
- Safety reports:
  - shoe: fixNow []
  - clothing: fixNow []
  - shoe readySku: 83, safePublic 81, probablySafe 2
  - clothing readySku: 49, safePublic 41, probablySafe 8

## Deferred
- Continue shoe safe-public tail chunks.
- Later check how many otherwise-valid listings were suppressed by exchange-inquiry-blocking copy before this parser fix.
