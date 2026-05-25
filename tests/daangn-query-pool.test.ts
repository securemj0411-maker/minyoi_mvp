// daangn-query-pool — catalog 기반 query 자동 생성 unit test.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildDaangnQueryPool } from "../src/lib/daangn-query-pool";

describe("buildDaangnQueryPool", () => {
  it("returns nonempty query list from catalog", () => {
    const queries = buildDaangnQueryPool({ maxQueries: 30 });
    assert.ok(queries.length > 0, "should produce queries from real catalog");
    assert.ok(queries.length <= 30, "should respect maxQueries cap");
  });

  it("each query has label + search + categoryIds", () => {
    const queries = buildDaangnQueryPool({ maxQueries: 10 });
    for (const q of queries) {
      assert.ok(typeof q.label === "string" && q.label.length > 0);
      assert.ok(typeof q.search === "string" && q.search.length >= 3);
      assert.ok(Array.isArray(q.categoryIds));
      assert.ok(q.categoryIds.every((id) => Number.isInteger(id) && id > 0));
    }
  });

  it("prefers shoe/clothing (top Pareto categories) in top results", () => {
    const queries = buildDaangnQueryPool({ maxQueries: 15 });
    const top10 = queries.slice(0, 10);
    const hotCategories = top10.filter((q) => q.label === "shoe" || q.label === "clothing");
    assert.ok(
      hotCategories.length >= 5,
      `top 10 query 중 절반 이상은 shoe/clothing 이어야 함 (실제: ${hotCategories.length}/10)`,
    );
  });

  it("dedup query strings", () => {
    const queries = buildDaangnQueryPool({ maxQueries: 100 });
    const seen = new Set<string>();
    for (const q of queries) {
      const key = q.search.toLowerCase();
      assert.ok(!seen.has(key), `duplicate query: ${q.search}`);
      seen.add(key);
    }
  });

  it("respects includeBroad=false (filters out -broad SKUs)", () => {
    const withBroad = buildDaangnQueryPool({ maxQueries: 100, includeBroad: true });
    const withoutBroad = buildDaangnQueryPool({ maxQueries: 100, includeBroad: false });
    assert.ok(
      withBroad.length >= withoutBroad.length,
      "withBroad 가 withoutBroad 보다 같거나 많아야 함",
    );
  });

  it("fashion queries get fashion categoryIds (14/5/31)", () => {
    const queries = buildDaangnQueryPool({ maxQueries: 30 });
    const fashion = queries.filter((q) => q.label === "shoe" || q.label === "clothing");
    for (const q of fashion) {
      assert.ok(
        q.categoryIds.some((id) => [14, 5, 31].includes(id)),
        `fashion query should map to category 14/5/31: ${q.search}`,
      );
    }
  });
});
