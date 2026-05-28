import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("Daangn detail access rejects missing same-source market basis before charging", () => {
  const route = source("src/app/api/packs/pool/detail-access/route.ts");
  const packOpen = source("src/lib/pack-open.ts");
  assert.match(route, /isDaangnMarketplaceSource\(item\.marketplaceSource\).*marketBasis\.sampleCount < 3/s);
  assert.match(route, /marketBasisUsable: false/);
  assert.match(route, /verifiedItem\.marketBasisUsable === false/);
  assert.match(route, /daangn_market_basis_missing/);
  assert.match(packOpen, /const daangnMarketBasisMissing = isDaangnMarketplaceSource\(meta\.marketplaceSource\)/);
  assert.match(packOpen, /marketBasis\.sampleCount < MIN_SOURCE_SAMPLE_COUNT_FOR_CONFIDENCE/);
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
