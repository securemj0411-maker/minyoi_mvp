import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { pickByConditionFallback } from "@/lib/condition-fallback";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("tiered market lookup prefers exact tier plus condition before class fallback", () => {
  const rows = new Map<string, { id: string; samples: number }>([
    ["a_grade|clean", { id: "exact-golf-a-clean", samples: 4 }],
    ["b_grade|normal", { id: "wrong-tier-normal", samples: 20 }],
    ["|clean", { id: "legacy-clean", samples: 20 }],
  ]);

  const picked = pickByConditionFallback(rows, "clean", (row) => row.samples, 1, "a_grade");

  assert.equal(picked.row?.id, "exact-golf-a-clean");
  assert.equal(picked.fallbackUsed, false);
});

test("tiered market lookup does not borrow a different tier when exact tier is missing", () => {
  const rows = new Map<string, { id: string; samples: number }>([
    ["b_grade|normal", { id: "wrong-tier-normal", samples: 20 }],
    ["C|", { id: "wrong-fashion-tier", samples: 20 }],
  ]);

  const picked = pickByConditionFallback(rows, "clean", (row) => row.samples, 1, "a_grade");

  assert.equal(picked.row, undefined);
});

test("Daangn detail access rejects missing same-source market basis before charging", () => {
  const route = source("src/app/api/packs/pool/detail-access/route.ts");
  const packOpen = source("src/lib/pack-open.ts");
  assert.match(route, /!marketBasis\.sourceSampleUsed/);
  assert.match(route, /marketBasis\.sourceSampleCount \?\? marketBasis\.sampleCount/);
  assert.match(route, /marketBasisUsable: false/);
  assert.match(route, /verifiedItem\.marketBasisUsable === false/);
  assert.match(route, /daangn_market_basis_missing/);
  assert.match(packOpen, /sourceMarketRequired = listingSource === DAANGN_SOURCE_ID/);
  assert.match(packOpen, /sourceStatUsable && !sourceConditionFallbackUsed/);
  assert.match(packOpen, /sourceMarketRequired \? undefined : mixedStat/);
  assert.match(packOpen, /const daangnMarketBasisMissing = isDaangnMarketplaceSource\(meta\.marketplaceSource\)/);
  assert.match(packOpen, /!marketBasis\.sourceSampleUsed/);
  assert.match(packOpen, /marketBasis\.sourceSampleCount \?\? marketBasis\.sampleCount/);
  assert.match(packOpen, /basisSource: useListingSourceStat \? listingSource : null/);
  assert.match(packOpen, /basisSourceLabel: useListingSourceStat \? marketplaceSourceLabel\(listingSource\) : null/);
  assert.match(packOpen, /rpcInvalidate\(candidate\.pid, "daangn_market_basis_missing"\)/);
  assert.match(route, /당근 기준 비교 매물이 아직 부족해 추천에서 내렸어요/);
});

test("/me and detail modal do not call source-basis gaps sold-completed", () => {
  const me = source("src/app/api/packs/me/route.ts");
  const dashboard = source("src/components/user-reveal-dashboard.tsx");
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(me, /daangnMarketBasisMissing/);
  assert.match(dashboard, /expectedProfitFromMarketPrice/);
  assert.match(dashboard, /marketplaceSource: item\.marketplaceSource/);
  assert.doesNotMatch(modal, /판매완료 처리/);
  assert.match(modal, /시세 근거 부족/);
  assert.match(modal, /보류 처리/);
  assert.match(modal, /같은 출처·같은 상태의 시세 근거가 아직 부족해요/);
});

test("Daangn comparable proof list is source-strict", () => {
  const marketSourceRoute = source("src/app/api/listings/[pid]/market-source/route.ts");
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(marketSourceRoute, /isDaangnMarketplaceSource\(ourMarketplaceSource\) && source !== ourMarketplaceSource/);
  assert.match(marketSourceRoute, /never show Bunjang\/Joongna rows as the visible proof for a Daangn listing/);
  assert.match(modal, /function isSameSourceComparableForCard/);
  assert.match(modal, /cardSource !== "daangn"/);
  assert.match(modal, /isSameSourceComparableForCard\(card, c\)/);
  assert.match(modal, /isSameSourceComparableForCard\(card, item\)/);
  assert.match(modal, /isShoeOrClothingCard\(card\) && tierShortLabel\(card\.conditionTier\)/);
});

test("Daangn feed and score stage fail closed when same-source market basis is missing", () => {
  const poolRoute = source("src/app/api/packs/pool/route.ts");
  const pipeline = source("src/lib/tick-pipeline.ts");

  assert.match(poolRoute, /marketStatsConditionKey\(row\.condition_tier \?\? "", row\.condition_class\)/);
  assert.match(poolRoute, /sourceAwareMedian\(sourceMarketBands, row\.comparable_key, row\.condition_class, grading\?\.tier \?\? null, marketplaceSource/);
  assert.match(poolRoute, /isDaangnMarketplaceSource\(source\) && fallbackUsed/);
  assert.match(poolRoute, /if \(!skuMedianFinal \|\| skuMedianFinal <= 0\) \{\s*recomputedProfitMin = 0;\s*recomputedProfitMax = 0;/s);
  assert.match(pipeline, /const fallbackMedian = requiresSourceMarket\s*\?\s*0/s);
  assert.match(pipeline, /const skuMedianCandidate = !requiresSourceMarket && referencePrice != null && referencePrice > 0/);
  assert.match(pipeline, /marketPriceStatsConditionKey\(row\.condition_tier \?\? "", row\.condition_class\)/);
  assert.match(pipeline, /pickPerSourceStatForMatter\([\s\S]*conditionTier/s);
  assert.match(pipeline, /normalizeMarketplaceSource\(matterSource\) === "daangn" && fallbackUsed/);
});

test("market history and preview use condition tier for visible price evidence", () => {
  const history = source("src/app/api/market/history/route.ts");
  const chart = source("src/components/market-history-chart.tsx");
  const modal = source("src/components/pack-reveal-modal.tsx");
  const preview = source("src/app/api/preview-pool/route.ts");

  assert.match(history, /condition_tier/);
  assert.match(history, /tierFilter/);
  assert.match(history, /pickByConditionFallback/);
  assert.match(chart, /conditionTier/);
  assert.match(chart, /&tier=/);
  assert.match(modal, /conditionTier=\{card\.conditionTier \?\? null\}/);
  assert.match(preview, /mvp_market_price_daily_per_source/);
  assert.match(preview, /condition_tier/);
  assert.match(preview, /isDaangnMarketplaceSource\(source\) && picked\.fallbackUsed/);
});
