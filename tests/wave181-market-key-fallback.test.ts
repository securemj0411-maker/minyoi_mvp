// Wave 181 (2026-05-17): broader market key fallback 회귀 방지.
// pool 부족 진단 (laptop 384 narrow lane 중 시세 trusted 4개 = 1%) 해소를 위한 fallback chain.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { broaderMarketKeyChain, pickPricesByBroaderChain } from "@/lib/market-key-fallback";

describe("Wave 181: broaderMarketKeyChain", () => {
  it("returns narrow + broader chain for macbook narrow key", () => {
    const chain = broaderMarketKeyChain("macbook|macbook_pro|2023y|m3|14in|16gb_ram|512gb_ssd");
    assert.equal(chain[0], "macbook|macbook_pro|2023y|m3|14in|16gb_ram|512gb_ssd");
    assert.equal(chain[1], "macbook|macbook_pro|2023y|m3|14in|16gb_ram");
    assert.equal(chain[chain.length - 1], "macbook|macbook_pro");
    // Verify monotonically broadening (each next is prefix of prior)
    for (let i = 1; i < chain.length; i += 1) {
      assert.ok(chain[i - 1].startsWith(chain[i]), `${chain[i - 1]} should start with ${chain[i]}`);
    }
  });

  it("preserves at least 2 segments (family + model)", () => {
    const chain = broaderMarketKeyChain("iphone|iphone_15_pro|256gb");
    assert.equal(chain[chain.length - 1], "iphone|iphone_15_pro");
    // Should not trim down to single segment
    assert.ok(chain.every((k) => k.split("|").length >= 2));
  });

  it("returns single-element chain for already-broad key (2 segments)", () => {
    const chain = broaderMarketKeyChain("macbook|macbook_pro");
    assert.deepEqual(chain, ["macbook|macbook_pro"]);
  });

  it("handles empty / invalid input gracefully", () => {
    assert.deepEqual(broaderMarketKeyChain(""), []);
    assert.deepEqual(broaderMarketKeyChain("single"), ["single"]);
  });

  it("handles shoe condition-tagged keys", () => {
    const chain = broaderMarketKeyChain("shoe|gazelle_og_broad|260|unknown_condition");
    assert.equal(chain[0], "shoe|gazelle_og_broad|260|unknown_condition");
    assert.equal(chain[1], "shoe|gazelle_og_broad|260");
    assert.equal(chain[chain.length - 1], "shoe|gazelle_og_broad");
  });
});

describe("Wave 181: pickPricesByBroaderChain", () => {
  it("picks narrow when narrow has enough samples", () => {
    const prices = new Map<string, number[]>();
    prices.set("macbook|macbook_pro|2023y|m3|14in|16gb_ram|512gb_ssd", [2000000, 2100000, 2050000, 2080000, 2030000]);
    const result = pickPricesByBroaderChain(
      "macbook|macbook_pro|2023y|m3|14in|16gb_ram|512gb_ssd",
      prices,
      5,
    );
    assert.equal(result.broader, false);
    assert.equal(result.prices.length, 5);
    assert.equal(result.key, "macbook|macbook_pro|2023y|m3|14in|16gb_ram|512gb_ssd");
  });

  it("falls back to broader when narrow is below threshold", () => {
    const prices = new Map<string, number[]>();
    // Narrow has only 2 samples
    prices.set("macbook|macbook_pro|2023y|m3|14in|16gb_ram|512gb_ssd", [2000000, 2100000]);
    // Broader has 8 samples
    prices.set("macbook|macbook_pro|2023y|m3|14in", [1900000, 2000000, 2100000, 2200000, 1950000, 2050000, 2150000, 2080000]);
    const result = pickPricesByBroaderChain(
      "macbook|macbook_pro|2023y|m3|14in|16gb_ram|512gb_ssd",
      prices,
      5,
    );
    // chain[0] = full (2 samples), chain[1] = ...|16gb_ram (0), chain[2] = ...|14in (8 — match)
    assert.equal(result.broader, true);
    assert.equal(result.prices.length, 8);
    assert.equal(result.key, "macbook|macbook_pro|2023y|m3|14in");
  });

  it("returns best available if nothing meets threshold", () => {
    const prices = new Map<string, number[]>();
    prices.set("macbook|macbook_pro|2023y|m3|14in|16gb_ram|512gb_ssd", [2000000]);
    prices.set("macbook|macbook_pro|2023y|m3", [1900000, 2000000, 2100000]);
    const result = pickPricesByBroaderChain(
      "macbook|macbook_pro|2023y|m3|14in|16gb_ram|512gb_ssd",
      prices,
      5,
    );
    // Neither meets threshold 5. Best available = "...m3" with 3 samples (broader).
    assert.equal(result.broader, true);
    assert.equal(result.prices.length, 3);
  });

  it("returns empty result if no prices at all", () => {
    const result = pickPricesByBroaderChain(
      "macbook|macbook_pro|2023y|m3|14in|16gb_ram|512gb_ssd",
      new Map(),
      5,
    );
    assert.equal(result.prices.length, 0);
  });

  it("respects shoe lower threshold (2)", () => {
    const prices = new Map<string, number[]>();
    prices.set("shoe|gazelle_og_broad|260|unknown_condition", [50000, 60000]);
    const result = pickPricesByBroaderChain("shoe|gazelle_og_broad|260|unknown_condition", prices, 2);
    assert.equal(result.broader, false);
    assert.equal(result.prices.length, 2);
  });
});
