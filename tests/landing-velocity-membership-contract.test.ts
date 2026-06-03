import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("guest landing preview is velocity-led and routes login to membership application", () => {
  const serverPreview = source("src/components/preview-masked-dashboard-server.tsx");
  const clientPreview = source("src/components/preview-masked-dashboard.tsx");

  for (const src of [serverPreview, clientPreview]) {
    assert.match(src, /평균 \$\{daysLabel\(item\.medianHoursToSold\)\} 내 판매/);
    assert.match(src, /빨리 사라지는 중고 매물|팔리는 속도까지 보고/);
    assert.match(src, /href="\/login\?next=\/plans"/);
    assert.doesNotMatch(src, /무료로 시작|첫 상세 1개는 무료/);
  }
});

test("preview pool only serves items with usable market velocity", () => {
  const route = source("src/app/api/preview-pool/route.ts");
  const cacheLib = source("src/lib/preview-pool-showcases.ts");
  const cronRoute = source("src/app/api/cron/preview-pool/route.ts");

  assert.match(route, /readPreviewPoolCache/);
  assert.match(route, /mvp_preview_showcases|precomputed DB materialized cache/);
  assert.match(route, /items\.length > 0/);
  assert.match(route, /no-store, max-age=0/);
  assert.doesNotMatch(route, /mvp_candidate_pool/);
  assert.doesNotMatch(route, /mvp_market_price_daily/);
  assert.doesNotMatch(route, /mvp_market_velocity_daily/);

  assert.match(cacheLib, /mvp_market_velocity_daily/);
  assert.match(cacheLib, /condition_class=eq\.all/);
  assert.match(cacheLib, /velocitySignalFromRow/);
  assert.match(cacheLib, /candidateRows = candidateRows\.filter\(\(row\) => row\.comparable_key \? velocityByKey\.has\(row\.comparable_key\) : false\)/);
  assert.match(cacheLib, /observedSoldSampleCount/);
  assert.match(cacheLib, /mvp_preview_showcases/);
  assert.match(cronRoute, /refreshPreviewPoolCache/);
});

test("plans page explains scarcity, local constraints, and quota management", () => {
  const plans = source("src/app/plans/page.tsx");
  const planConfig = source("src/lib/membership-plans.ts");

  assert.match(plans, /돈 되는 매물은 적고/);
  assert.match(plans, /당근은 내 근처/);
  assert.match(plans, /티오를 관리/);
  assert.match(plans, /지역별로 티오/);
  assert.match(plans, /아무나 보면 그마저도 사라집니다/);
  assert.match(planConfig, /월 33,000원꼴/);
  assert.match(planConfig, /priceKrw: 99_000/);
  assert.match(plans, /신청은 먼저 누르고, 기간은 다음 단계에서 고릅니다/);
  assert.doesNotMatch(plans, /결제 페이지가 아니라/);
  assert.doesNotMatch(plans, /베타|초기 베타/);
});
