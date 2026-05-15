import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  decayTrimmedSellerMarket,
  exponentialDecayWeight,
  trimmedSellerMarket,
  weightedMedian,
} from "@/lib/market-math";

describe("Wave 131 — decay-weighted market price", () => {
  it("exponentialDecayWeight: 7일 매물 ~1.5x, 30일 ~0.15x (보고서 권장)", () => {
    const w0 = exponentialDecayWeight(0);
    const w7 = exponentialDecayWeight(7);
    const w30 = exponentialDecayWeight(30);
    assert.equal(Math.round(w0 * 10) / 10, 3.0); // 신선 매물 weight 3x
    assert.ok(w7 > 1.4 && w7 < 1.6, `7일 weight: ${w7}`); // ~1.5x
    assert.ok(w30 < 0.2, `30일 weight: ${w30}`); // 0.15x 정도
  });

  it("weightedMedian: 옛 매물 weight 낮으면 시세 무시", () => {
    // 최근 매물 7건 (가격 100K, weight 1.5x) + 옛 매물 1건 (200K, weight 0.15x)
    const items = [
      { value: 100000, weight: 1.5 },
      { value: 100000, weight: 1.5 },
      { value: 100000, weight: 1.5 },
      { value: 100000, weight: 1.5 },
      { value: 100000, weight: 1.5 },
      { value: 100000, weight: 1.5 },
      { value: 100000, weight: 1.5 },
      { value: 200000, weight: 0.15 }, // 옛 호가 — weight 적어서 시세 끌어올리면 안 됨
    ];
    const result = weightedMedian(items);
    assert.equal(result, 100000, `옛 매물에 영향받지 않아야: ${result}`);
  });

  it("decayTrimmedSellerMarket: observedAt 없으면 fallback 동작", () => {
    const rows = [
      { pid: 1, price: 100000, seller_uid: "a", observedAt: null },
      { pid: 2, price: 110000, seller_uid: "b", observedAt: null },
      { pid: 3, price: 120000, seller_uid: "c", observedAt: null },
      { pid: 4, price: 130000, seller_uid: "d", observedAt: null },
      { pid: 5, price: 140000, seller_uid: "e", observedAt: null },
    ];
    const result = decayTrimmedSellerMarket(rows);
    // ageDays null → weight 1.0 → 일반 median 동작
    assert.equal(result.count, 5);
    assert.equal(result.median, 120000);
  });

  it("decayTrimmedSellerMarket: 옛 호가 inflated 무시 (사업 가치)", () => {
    const now = Date.now();
    const recent = (daysAgo: number) =>
      new Date(now - daysAgo * 86_400_000).toISOString();
    // 최근 7건 (1~7일 전, 100K~115K) + 옛 호가 1건 (45일 전, 250K = 셀러 inflated)
    const rows = [
      { pid: 1, price: 100000, seller_uid: "a", observedAt: recent(1) },
      { pid: 2, price: 105000, seller_uid: "b", observedAt: recent(2) },
      { pid: 3, price: 110000, seller_uid: "c", observedAt: recent(3) },
      { pid: 4, price: 110000, seller_uid: "d", observedAt: recent(4) },
      { pid: 5, price: 110000, seller_uid: "e", observedAt: recent(5) },
      { pid: 6, price: 115000, seller_uid: "f", observedAt: recent(6) },
      { pid: 7, price: 115000, seller_uid: "g", observedAt: recent(7) },
      // outlier-범위 안에 들어가는 옛 호가 (madTrim에 안 잘릴 정도). decay weight ↓로 시세 영향 최소화.
      { pid: 8, price: 140000, seller_uid: "h", observedAt: recent(45) },
    ];
    const result = decayTrimmedSellerMarket(rows);
    // 옛 호가 weight 0.03 (45일) → 거의 무시. 시세는 최근 매물 기반.
    assert.ok(result.median != null && result.median <= 115000,
      `옛 호가에 끌려가면 안 됨. median: ${result.median}`);
  });

  it("decayTrimmedSellerMarket: seller당 가장 최근 매물 우선 (옛 매물 자동 dedupe)", () => {
    const now = Date.now();
    const recent = (daysAgo: number) =>
      new Date(now - daysAgo * 86_400_000).toISOString();
    // 같은 seller가 옛 호가 (200K, 30일) + 새로 올린 호가 (100K, 1일) 동시 → 최근 거 채택
    const rows = [
      { pid: 1, price: 200000, seller_uid: "seller1", observedAt: recent(30) },
      { pid: 2, price: 100000, seller_uid: "seller1", observedAt: recent(1) },
      { pid: 3, price: 100000, seller_uid: "seller2", observedAt: recent(1) },
      { pid: 4, price: 100000, seller_uid: "seller3", observedAt: recent(2) },
      { pid: 5, price: 105000, seller_uid: "seller4", observedAt: recent(3) },
      { pid: 6, price: 110000, seller_uid: "seller5", observedAt: recent(4) },
    ];
    const result = decayTrimmedSellerMarket(rows);
    // seller1의 옛 매물(200K)이 채택되면 시세 끌어올림 — 최근 매물(100K)이 채택되어야.
    assert.ok(result.median != null && result.median <= 105000,
      `seller당 최근 매물 선택. median: ${result.median}`);
  });

  it("decayTrimmedSellerMarket vs trimmedSellerMarket: 옛 매물 영향 비교", () => {
    const now = Date.now();
    const recent = (daysAgo: number) =>
      new Date(now - daysAgo * 86_400_000).toISOString();
    // 옛 호가(30일+, 300K) 다수 + 최근 거래가 낮음 (100K)
    const rows = [
      { pid: 1, price: 100000, seller_uid: "a", observedAt: recent(1) },
      { pid: 2, price: 100000, seller_uid: "b", observedAt: recent(2) },
      { pid: 3, price: 105000, seller_uid: "c", observedAt: recent(3) },
      { pid: 4, price: 200000, seller_uid: "d", observedAt: recent(45) }, // 옛 호가
      { pid: 5, price: 200000, seller_uid: "e", observedAt: recent(60) }, // 옛 호가
    ];
    const decayResult = decayTrimmedSellerMarket(rows);
    const oldResult = trimmedSellerMarket(rows);
    // decay 시세는 최근 매물 더 반영 → 옛 시세보다 낮음
    assert.ok(
      decayResult.median != null && oldResult.median != null &&
        decayResult.median < oldResult.median,
      `decay median (${decayResult.median}) < old median (${oldResult.median}) 이어야`,
    );
  });

  it("decayTrimmedSellerMarket: 빈 rows → null", () => {
    const result = decayTrimmedSellerMarket([]);
    assert.equal(result.count, 0);
    assert.equal(result.median, null);
    assert.equal(result.p25, null);
    assert.equal(result.p75, null);
  });
});
