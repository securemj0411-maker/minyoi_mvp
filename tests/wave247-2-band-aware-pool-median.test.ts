// Wave 247.2 (2026-05-19): band-aware sku_median fallback.
// pool API 에서 mvp_listings.sku_median (전체 median) 직접 사용 → condition_class 무시.
// 사용자 풀의 16% sku_median=0 → "시세 0원" 미스리딩 (Wave 246 측정).
// 새: mvp_market_price_daily band lookup → 매칭 band 우선, 없으면 fallback chain.
//
// 본 test 는 pool route 의 helper `bandAwareMedian` 로직을 직접 검증할 수 없으므로
// (route.ts 내 private function), 동일 패턴 (pickByConditionFallback) 의 fallback chain 동작을
// pool-specific context 로 검증한다.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickByConditionFallback } from "@/lib/condition-fallback";

type MarketBandRow = {
  comparable_key: string;
  condition_class: string;
  blended_median_price: number | null;
  active_median_price: number | null;
  active_sample_count: number | null;
  sold_sample_count: number | null;
  disappeared_sample_count: number | null;
};

function bandAwareMedian(
  bandMap: Map<string, Map<string, MarketBandRow>>,
  comparableKey: string | null,
  conditionClass: string | null,
): number | null {
  if (!comparableKey) return null;
  const byCondition = bandMap.get(comparableKey);
  if (!byCondition) return null;
  const { row } = pickByConditionFallback(
    byCondition,
    conditionClass,
    (r) => Number(r.active_sample_count ?? 0) + Number(r.sold_sample_count ?? 0) + Number(r.disappeared_sample_count ?? 0),
  );
  if (!row) return null;
  const price = row.blended_median_price ?? row.active_median_price ?? null;
  return price && price > 0 ? price : null;
}

function makeRow(condition_class: string, price: number, samples = 5): MarketBandRow {
  return {
    comparable_key: "test|test",
    condition_class,
    blended_median_price: price,
    active_median_price: price,
    active_sample_count: samples,
    sold_sample_count: 0,
    disappeared_sample_count: 0,
  };
}

describe("Wave 247.2 — bandAwareMedian (pool API band-aware fallback)", () => {
  it("정확 band 매칭: mint condition + mint band → mint 가격", () => {
    const bandMap = new Map<string, Map<string, MarketBandRow>>();
    bandMap.set("apparel|test", new Map<string, MarketBandRow>([
      ["mint", makeRow("mint", 500000)],
      ["clean", makeRow("clean", 400000)],
      ["normal", makeRow("normal", 300000)],
    ]));
    const price = bandAwareMedian(bandMap, "apparel|test", "mint");
    assert.equal(price, 500000, "mint band 정확 매칭");
  });

  it("mint band 없으면 clean fallback (위로 차단)", () => {
    const bandMap = new Map<string, Map<string, MarketBandRow>>();
    bandMap.set("apparel|test", new Map<string, MarketBandRow>([
      // mint 없음
      ["clean", makeRow("clean", 400000)],
      ["normal", makeRow("normal", 300000)],
    ]));
    const price = bandAwareMedian(bandMap, "apparel|test", "mint");
    assert.equal(price, 400000, "mint → clean fallback");
  });

  it("worn band 없으면 normal fallback (worn → normal)", () => {
    const bandMap = new Map<string, Map<string, MarketBandRow>>();
    bandMap.set("apparel|test", new Map<string, MarketBandRow>([
      // worn 없음
      ["mint", makeRow("mint", 500000)],
      ["normal", makeRow("normal", 300000)],
    ]));
    const price = bandAwareMedian(bandMap, "apparel|test", "worn");
    assert.equal(price, 300000, "worn → normal fallback (mint 임의 잡지 X)");
  });

  it("CRITICAL: flawed band 만 있어도 worn/normal 없으면 sku_median fallback (null 반환)", () => {
    // pid 408329098 회귀 보호 — flawed 매물에 mint/unopened 가격 fallback 차단.
    const bandMap = new Map<string, Map<string, MarketBandRow>>();
    bandMap.set("apparel|test", new Map<string, MarketBandRow>([
      ["mint", makeRow("mint", 500000)],
      // worn/normal 없음 → flawed 매물에 mint 임의 fallback 차단
    ]));
    const price = bandAwareMedian(bandMap, "apparel|test", "flawed");
    assert.equal(price, null, "flawed + mint 만 → null (호출 측에서 raw sku_median fallback)");
  });

  it("comparable_key 없으면 null", () => {
    const bandMap = new Map<string, Map<string, MarketBandRow>>();
    bandMap.set("apparel|test", new Map<string, MarketBandRow>([
      ["normal", makeRow("normal", 300000)],
    ]));
    const price = bandAwareMedian(bandMap, null, "normal");
    assert.equal(price, null);
  });

  it("comparable_key 미매칭 → null (호출 측에서 raw sku_median fallback)", () => {
    const bandMap = new Map<string, Map<string, MarketBandRow>>();
    bandMap.set("apparel|test", new Map<string, MarketBandRow>([
      ["normal", makeRow("normal", 300000)],
    ]));
    const price = bandAwareMedian(bandMap, "apparel|other", "normal");
    assert.equal(price, null);
  });

  it("band 있지만 가격 0/null → null (sku_median fallback)", () => {
    const bandMap = new Map<string, Map<string, MarketBandRow>>();
    bandMap.set("apparel|test", new Map<string, MarketBandRow>([
      ["normal", { ...makeRow("normal", 0), blended_median_price: 0, active_median_price: 0 }],
    ]));
    const price = bandAwareMedian(bandMap, "apparel|test", "normal");
    assert.equal(price, null, "0 가격은 null → fallback 가능");
  });

  it("blended_median_price 우선 (active_median_price fallback)", () => {
    const bandMap = new Map<string, Map<string, MarketBandRow>>();
    bandMap.set("apparel|test", new Map<string, MarketBandRow>([
      ["normal", { ...makeRow("normal", 0), blended_median_price: 350000, active_median_price: 320000 }],
    ]));
    const price = bandAwareMedian(bandMap, "apparel|test", "normal");
    assert.equal(price, 350000, "blended 우선");
  });

  it("blended_median_price null 이면 active_median_price 사용", () => {
    const bandMap = new Map<string, Map<string, MarketBandRow>>();
    bandMap.set("apparel|test", new Map<string, MarketBandRow>([
      ["normal", { ...makeRow("normal", 0), blended_median_price: null, active_median_price: 320000 }],
    ]));
    const price = bandAwareMedian(bandMap, "apparel|test", "normal");
    assert.equal(price, 320000, "blended null → active fallback");
  });

  it("conditionClass null → normal chain 사용", () => {
    const bandMap = new Map<string, Map<string, MarketBandRow>>();
    bandMap.set("apparel|test", new Map<string, MarketBandRow>([
      ["normal", makeRow("normal", 300000)],
    ]));
    const price = bandAwareMedian(bandMap, "apparel|test", null);
    assert.equal(price, 300000, "null condition → normal default");
  });
});
