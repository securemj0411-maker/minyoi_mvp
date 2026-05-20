# Wave 426 — Thom Browne bait cleanup + targeted broad-lane hygiene

Date: 2026-05-21

## Context

After Wave 425, parser/category drift was mostly clean, but the targeted fashion sweep still showed 25 broad comparable groups with high price spread. The top offender was `clothing|thombrowne_apparel_broad|knit|a_grade`, where a 6,000원 "톰브라운 스탈 강아지 니트" row was mixed with normal 50만~80만원 Thom Browne knit rows.

## Decisions Applied

- Kept the broad-lane policy conservative: only clear rows with strong evidence of being non-comparable bait, not every low-price outlier.
- Added Thom Browne apparel broad rejects for:
  - `톰브라운 스타일/스탈/룩`
  - pet apparel knit terms (`강아지 니트`, `애견 니트`, `반려견 니트`, `dog knit`)
  - detected Tommy/suspender bait (`서스펜더`, `타미진스`, `타미힐피거`)
- Tightened fashion diagnostic category-conflict heuristics:
  - English `shoulder` no longer counts as a bag signal unless it is `shoulder bag`.
  - `더플자켓/duffle jacket` and `패딩 테크 카세트` no longer create false clothing/bag conflicts.
- Production DB alignment:
  - Cleared raw SKU for confirmed bait pids `258795189` and `385327248`.
  - Re-upserted targeted v12 parsed rows for the four inspected broad lanes to current clothing parser v13.
  - Invalidated one newly surfaced pool row blocked by current gate (`shoe-nike-airforce-1-low-white`, pid `409240779`) via the existing pool gate cleanup script.

## Verification

- Tests: `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 156 pass / 0 fail.
- Targeted sweep (`thombrowne/cdg/carhartt/champion broad`, null sample cap 1000):
  - rawSkuRejectedByCurrentCatalog: 0
  - rawSkuDiffersFromCurrentCatalog: 0
  - dbCleanButCurrentCatalogRejects: 0
  - dbCleanButCurrentCatalogChangesKey: 0
  - parsedStaleVersion: 0
  - poolExposedWithDrift: 0
  - dbProductTypeUnknown: 0
  - categoryConflictFlags: {}
  - parserVersions: `clothing:wave216-clothing-v13` 726
- Pool purity after cleanup:
  - activeFashionPoolRows: 60
  - gateBlockedRows: 0
  - flaggedRows: 0
  - actionableRows: 0

## Deferred

- Remaining broad price-spread groups are still broad-lane quality work, not current parser drift:
  - `thombrowne_apparel_broad|knit|c_grade` still has a 25,000원 low outlier vs 42만~63만원 core.
  - `thombrowne_apparel_broad|shirt|b_grade` still has 50,000원 rows vs 22만~55만원 core.
  - Champion/Carhartt broad rows remain price-wide because they mix vintage/core/basic lines.
- Size-based turnover segmentation was intentionally deferred to a later wave. Current comparable_key keeps size out for clothing/bag price, but rotation/sample grouping may need a separate velocity axis.
- Score-stage cleanup touched pending dirty rows beyond this wave. A second score-stage run was executed with `AI_L2_SHADOW_AUDIT_ENABLED=0`, but the first run still recorded shadow audit spend and the second run still allowed score AI review before it was fully disabled. Future forced score-stage runs should explicitly set both `AI_L2_SHADOW_AUDIT_ENABLED=0` and `PIPELINE_AI_REVIEW_TOP_N=0` from the start.
