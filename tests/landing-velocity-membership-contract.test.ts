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

  assert.match(route, /mvp_market_velocity_daily/);
  assert.match(route, /condition_class=eq\.all/);
  assert.match(route, /velocitySignalFromRow/);
  assert.match(route, /candidateRows = candidateRows\.filter\(\(row\) => row\.comparable_key \? velocityByKey\.has\(row\.comparable_key\) : false\)/);
  assert.match(route, /observedSoldSampleCount/);
  assert.doesNotMatch(route, /mvp_market_velocity"\)\?select/);
});

test("plans page explains scarcity, local constraints, and quota management", () => {
  const plans = source("src/app/plans/page.tsx");

  assert.match(plans, /돈 되는 매물은 적고/);
  assert.match(plans, /당근은 내 근처/);
  assert.match(plans, /티오를 관리/);
  assert.match(plans, /지역별로 티오/);
  assert.doesNotMatch(plans, /베타|초기 베타/);
});
