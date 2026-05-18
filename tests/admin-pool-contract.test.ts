import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("admin pool exposes ready counts and filters by price bucket and category", () => {
  const browser = source("src/components/admin-pool-browser.tsx");
  const adminRoute = source("src/app/api/admin/pool-listings/route.ts");
  const publicRoute = source("src/app/api/public/pool-listings/route.ts");

  assert.match(browser, /가격대별 ready/);
  assert.match(browser, /카테고리별 ready/);
  assert.match(browser, /params\.set\("priceBucket", priceBucket\)/);
  assert.match(browser, /params\.set\("category", category\)/);
  assert.match(browser, /필터 초기화/);
  assert.match(browser, /MarketHistoryChart comparableKey=\{item\.comparableKey\} currentPrice=\{item\.price\} lazy/);

  for (const route of [adminRoute, publicRoute]) {
    assert.match(route, /const PRICE_BUCKETS = \[/);
    assert.match(route, /15만원 이하/);
    assert.match(route, /15~30만원/);
    assert.match(route, /priceBucketFilter/);
    assert.match(route, /byPriceBucket/);
    assert.match(route, /byCategory/);
    assert.match(route, /category=eq/);
    assert.match(route, /const hasExternalFilters = Boolean\(priceBucket \|\| skuFilter \|\| searchQuery\)/);
    assert.match(route, /priceBucketFor\(price\) !== priceBucket/);
    assert.match(route, /rawSkuMap\.get\(pid\) !== skuFilter/);
    assert.match(route, /comparableKey\.includes\(query\)/);
    assert.match(route, /allFilteredRows\.slice\(offset, offset \+ pageSize\)/);
  }
});

test("risk score detail trigger is written as an obvious clickable question", () => {
  const riskScore = source("src/components/risk-score-bar.tsx");

  assert.match(riskScore, /왜 안전한가요\?/);
  assert.match(riskScore, /주의 \$\{hitCount\}건이 있어요/);
  assert.match(riskScore, /위험 신호 \$\{hitCount\}건 확인/);
  assert.match(riskScore, /aria-expanded=\{open\}/);
  assert.doesNotMatch(riskScore, /aria-label="위험 신호 상세 보기"[\s\S]*>\s*\?/);
});
