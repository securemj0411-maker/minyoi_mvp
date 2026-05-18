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

  assert.match(riskScore, /왜 이 제품이 안전한가요\?/);
  assert.match(riskScore, /주의 \$\{hitCount\}건이 있어요/);
  assert.match(riskScore, /위험 신호 \$\{hitCount\}건 확인/);
  assert.match(riskScore, /AlertTriangleIcon/);
  assert.match(riskScore, /ShieldIcon/);
  assert.match(riskScore, /py-0\.5 text-\[10px\] font-black leading-none/);
  assert.match(riskScore, /role="dialog"/);
  assert.match(riskScore, /left-1\/2 top-\[72px\] z-\[130\]/);
  assert.match(riskScore, /-translate-x-1\/2 overflow-hidden/);
  assert.match(riskScore, /max-h-\[calc\(100dvh-156px\)\]/);
  assert.match(riskScore, /max-h-\[calc\(100dvh-232px\)\]/);
  assert.match(riskScore, /sm:w-\[30rem\]/);
  assert.match(riskScore, /text-\[13px\] font-bold leading-5/);
  assert.match(riskScore, /lv < 3 - a\.level/);
  assert.match(riskScore, /@keyframes riskSheetSettle/);
  assert.match(riskScore, /transform: translate\(-50%, -8px\)/);
  assert.match(riskScore, /animation: riskSheetSettle 130ms ease-out/);
  assert.match(riskScore, /추천 전에 걸러낸 뒤, 남은 확인 포인트만 보여드려요/);
  assert.match(riskScore, /확인하면 좋아요/);
  assert.match(riskScore, /후기가 0건인 신규 판매자예요/);
  assert.match(riskScore, /사진이 1장뿐이에요/);
  assert.match(riskScore, /배터리 효율이 안 적혀 있어요/);
  assert.match(riskScore, /강한 차단 신호가 있는 매물은 추천 풀에 넣지 않아요/);
  assert.match(riskScore, /aria-expanded=\{open\}/);
  assert.doesNotMatch(riskScore, /hard-block 필터/);
  assert.doesNotMatch(riskScore, /🛡️|⚠️|🚨|🔍/);
  assert.doesNotMatch(riskScore, /scale\(0\.98\)/);
  assert.doesNotMatch(riskScore, /aria-label="위험 신호 상세 보기"[\s\S]*>\s*\?/);
});
