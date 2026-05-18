import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("/me detail analysis uses the canonical parsed listing table", () => {
  const route = source("src/app/api/packs/reveals/detail/route.ts");
  assert.match(route, /tableUrl\("mvp_listing_parsed"\)/);
  assert.doesNotMatch(route, /mvp_parsed_listings/);
});

test("/me user modal does not expose the market source debug panel", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  assert.doesNotMatch(modal, /MarketSourceDebug/);
  assert.doesNotMatch(modal, /상세 비교/);
  assert.doesNotMatch(modal, /디버그/);
});

test("/me treats zero net profit as terminal for user-facing display", () => {
  const api = source("src/app/api/packs/me/route.ts");
  const dashboard = source("src/components/user-reveal-dashboard.tsx");
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(api, /market_invalidated:\s*min <= 0/);
  assert.match(api, /marketGapKrw <= 0/);
  assert.match(dashboard, /card\.expectedProfitMin <= 0/);
  assert.match(modal, /Math\.min\(card\.expectedProfitMin, card\.expectedProfitMax\) <= 0/);
});

test("/me user modal explains recommendation trust in plain language", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /왜 이걸 추천했나요\?/);
  assert.match(modal, /같은 모델로 묶었어요/);
  assert.match(modal, /기준 시세예요/);
  assert.match(modal, /비용을 빼고 계산했어요/);
  assert.match(modal, /상태가 다른 매물을 섞어 시세를 부풀리지 않아요/);
  assert.doesNotMatch(modal, />\s*band \{card\.band\}/);
});

test("/me keeps dashboard summary compact on mobile", () => {
  const dashboard = source("src/components/user-reveal-dashboard.tsx");

  assert.match(dashboard, /sm:hidden/);
  assert.match(dashboard, /판매중 \{dashboardSummary\.activeCount/);
  assert.match(dashboard, /평균 \{signedKrw\(dashboardSummary\.avgProfit\)\}/);
  assert.match(dashboard, /hidden gap-2 sm:grid/);
});
