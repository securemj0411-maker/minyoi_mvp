# 2026-05-25 Wave876 Shoe Safe Public Tail Audit

## Scope
- Audited shoe safe-public tail SKUs: Lacoste sneakers, Nike Sacai broad, Puma Suede, CDG Converse, Supreme Nike Air Max, MM6 Salomon, Asics Novablast, Hermes Izmir, Yeezy Foam Runner, Puma Palermo, Margiela Tabi/GAT, Dior B23, TNF Nuptse Mule, Off-White Dunk.
- Goal: remove broad sample pollution without lowering normal sell listings to null.

## Decisions
- Split Nike Sacai exact model rows away from the old broad fallback.
  - Added `블레이져 로우` as a Sacai broad blocker so `블레이저/블레이져 로우` routes to `shoe-nike-sakai-blazer-low`.
  - Applied reclassifications to Blazer Low, LD Waffle, VaporWaffle, and Cortez exact SKUs.
- Kept seller aftercare phrases from being misread as exchange requests.
  - `교신×`, `교환 환불 교신 ×`, and `교신/착샷 문의 ... 사양` now stay eligible when the listing is otherwise a sell listing.
- Separated Asics Superblast from Novablast.
  - Removed Superblast tokens from the Novablast broad rule.
  - Reclassified current Superblast rows to the existing `shoe-asics-superblast` SKU.
- Allowed the Lacoste Canaby Pique shoe model through the shoe noise gate only when `카나비/canaby` is present.

## Applied Result
- Dry-run before apply: scanned 1,063, candidates 131, reclassify 14, refresh 117, reject 0.
- Apply result: scanned 1,063, candidates 131, reclassify 14, refresh 117, reject 0.
- Stage result: queued 52, enriched 52, scored 829, poolUpserted 797.
- Cleanup result: applied 2 old shoe gate-blocked residue rows, both `wave410_lane_blocked_puma_nitro_running`.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts`: 69 passed.
- `npx tsx scripts/report-shoe-sku-safety.ts --category=shoe`: fixNow 0, readySku 85, safe_public 83, probably_safe 2.
- `npx tsx scripts/report-shoe-sku-safety.ts --category=clothing`: surfaced `clothing-moncler-broad` as next fixNow.

## Deferred
- CDG Converse still uses a legacy id ending in `white` even though the rule functions as CDG Converse broad. No behavior change made in this wave because the current safety report stayed clean.
- Next action: inspect and repair `clothing-moncler-broad` fixNow before continuing lower shoe/clothing batches.
