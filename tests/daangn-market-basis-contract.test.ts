import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("Daangn detail access rejects missing same-source market basis before charging", () => {
  const route = source("src/app/api/packs/pool/detail-access/route.ts");
  assert.match(route, /isDaangnMarketplaceSource\(item\.marketplaceSource\).*marketBasis\.sampleCount < 3/s);
  assert.match(route, /marketBasisUsable: false/);
  assert.match(route, /verifiedItem\.marketBasisUsable === false/);
  assert.match(route, /daangn_market_basis_missing/);
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
