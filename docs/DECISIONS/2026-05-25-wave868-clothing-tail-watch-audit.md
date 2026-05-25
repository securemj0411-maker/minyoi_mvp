# Wave 868 Clothing Tail Watch Audit

Date: 2026-05-25

## Context
- Continued clothing deep sweep through low-volume `watch_internal_only` lanes and legacy/narrow tail lanes.

## Scope
- Audited current parsed/pool rows for tail watch lanes including:
  - FOG main hoodie, Carhartt Heritage USA, MLB broad, legacy MM6, CDG Homme Plus, TNF Baltoro, CDG Play Hoodie, Stone Island Overshirt, Acne Polo, TNF Supreme model lanes, Adidas FOG, Reebok apparel, Junya collabs, Carhartt Landon, Acne denim tails, Polo Stadium, Stussy 8 Ball Knit, Thug Club Teamgeist.

## Decisions Applied
- Split Thug Club × Adidas Team Geist leather jacket from Team Geist hoodie.
  - New lane: `clothing-thugclub-teamgeist-leather-jacket`.
  - Readiness: blocked/internal until enough clean samples exist.
  - Hoodie lane now requires hoodie/hood tokens and no longer accepts leather jacket wording.
- Repaired Carhartt Landon collision.
  - Removed `landon/랜든` from ready `carhartt_denim_pants` broad matcher.
  - Added explicit blocked readiness for `carhartt_landon_pants`.
  - Landon rows now refresh/stay in exact internal lane instead of falling null or colliding with ready denim broad.
- Rehomed/held tail pollutants:
  - MLB Nike rows -> `clothing-mlb-nike-jersey-collab`.
  - CDG Homme Plus rows -> `clothing-cdg-homme-plus`.
  - Adidas FOG rows -> `clothing-adidas-fog-collab`.
  - Junya Brooks Brothers rows -> `clothing-junya-brooks-brothers-collab`.
  - Polo Chief Keef/Stadium legacy row -> `clothing-polo-stadium-1992-og`.
  - Stussy 8 Ball knit rows refreshed into exact knit lane.
  - MM6 legacy broad rows that no longer have a safe exact current match were rejected/held.

## Applied Backfill
- Command: `scripts/apply-fashion-current-catalog-reclassify.ts --reason=wave868_clothing_tail_watch_audit --apply`
- Result:
  - scannedParsedRows: 295
  - candidateRows: 101
  - reclassifyRows: 30
  - refreshParsedRows: 47
  - rejectRows: 24

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 65/65 passed.
- `npx tsx scripts/run-market-stats-stage-once.ts`
  - queued: 90
  - enriched: 90
  - scored: 1725
  - poolUpserted: 1475
  - reveal_current_profit_updated: 16
  - reveal_current_profit_invalidated: 0
- `npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --apply`
  - candidateRows: 0
- Safety reports:
  - shoe: fixNow []
  - clothing: fixNow []
  - clothing readySku: 49, safePublic 41, probablySafe 8.

## Deferred
- MM6 legacy apparel remains held/null because legacy and newer broad MM6 lanes conflict, and public release needs a cleaner model/product split.
- Acne polo and Reebok collab tail rows remain held unless enough clean repeated patterns appear.
- Team Geist leather jacket is cataloged but internal-only until sample comparison is proven.

