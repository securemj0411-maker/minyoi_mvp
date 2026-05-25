// Daangn ingest module — pure logic tests (no network, no DB).
//
// runDaangnIngest 자체는 fetch 의존이라 통합 테스트는 별도 (probe 스크립트 활용).
// 여기는 selectDaangnCombos / inferDaangnShipping / age bucket 등 pure helper.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  inferDaangnShipping,
  selectDaangnCombos,
} from "../src/lib/daangn-ingest";
import {
  DAANGN_FASHION_CATEGORIES,
  DEFAULT_DAANGN_FASHION_QUERY_SEEDS,
  DEFAULT_DAANGN_REGION_SEEDS,
  type DaangnDetailArticle,
  type DaangnSearchArticle,
} from "../src/lib/daangn";

function makeArticle(overrides: Partial<DaangnSearchArticle> = {}): DaangnSearchArticle {
  return {
    id: "1",
    href: "/kr/buy-sell/test/",
    title: "test",
    price: 10000,
    status: "Ongoing",
    content: null,
    thumbnail: null,
    createdAt: null,
    boostedAt: null,
    favoriteCount: null,
    chatCount: null,
    viewCount: null,
    region: { dbId: "6091", name: "사당동" },
    category: { dbId: "354", name: "신발" },
    user: { dbId: "1", nickname: "tester", webCrawlNotAllowed: false },
    ...overrides,
  };
}

describe("selectDaangnCombos", () => {
  it("returns at most maxCombos with region-first rotation", () => {
    const result = selectDaangnCombos({
      regions: DEFAULT_DAANGN_REGION_SEEDS.slice(0, 3),
      queries: DEFAULT_DAANGN_FASHION_QUERY_SEEDS.slice(0, 2),
      categories: DAANGN_FASHION_CATEGORIES.slice(0, 2),
      maxCombos: 4,
    });
    assert.equal(result.combos.length, 4);
    // region 우선: 첫 번째 region 의 combo 가 먼저 나옴
    assert.equal(result.combos[0].region.id, DEFAULT_DAANGN_REGION_SEEDS[0].id);
  });

  it("respects query.categoryIds filter", () => {
    const result = selectDaangnCombos({
      regions: [DEFAULT_DAANGN_REGION_SEEDS[0]],
      queries: [{ label: "test", search: "test", categoryIds: [DAANGN_FASHION_CATEGORIES[0].id] }],
      categories: DAANGN_FASHION_CATEGORIES.slice(0, 2),
      maxCombos: 10,
    });
    assert.equal(result.combos.length, 1, "only matching category included");
    assert.equal(result.combos[0].category.id, DAANGN_FASHION_CATEGORIES[0].id);
  });

  it("totalSpace counts all permutations even if maxCombos limits output", () => {
    const result = selectDaangnCombos({
      regions: DEFAULT_DAANGN_REGION_SEEDS.slice(0, 3),
      queries: DEFAULT_DAANGN_FASHION_QUERY_SEEDS.slice(0, 4),
      categories: DAANGN_FASHION_CATEGORIES.slice(0, 2),
      maxCombos: 5,
    });
    assert.equal(result.totalSpace, 3 * 4 * 2);
    assert.equal(result.combos.length, 5);
  });
});

describe("inferDaangnShipping (conservative default)", () => {
  it("explicit direct-trade only → direct_only", () => {
    const a = makeArticle({ title: "나이키 신발", content: "직거래만 가능합니다 택배 불가" });
    assert.equal(inferDaangnShipping(a), "direct_only");
  });

  it("explicit shipping mention → shipping_possible", () => {
    const a = makeArticle({ title: "나이키 신발", content: "택배 가능합니다 안전결제 OK" });
    assert.equal(inferDaangnShipping(a), "shipping_possible");
  });

  it("CU 편의점 택배 mention → shipping_possible", () => {
    const a = makeArticle({ content: "CU 편의점 택배로 보내드려요" });
    assert.equal(inferDaangnShipping(a), "shipping_possible");
  });

  it("당근페이 mention → shipping_possible", () => {
    const a = makeArticle({ content: "당근페이로 안전결제 가능" });
    assert.equal(inferDaangnShipping(a), "shipping_possible");
  });

  it("no signal → unknown (보수적)", () => {
    const a = makeArticle({ content: "사이즈 270 새상품" });
    assert.equal(inferDaangnShipping(a), "unknown");
  });

  it("direct + 택배 동시 언급 시 direct_only 우선 (보수적)", () => {
    const a = makeArticle({ content: "직거래만 받습니다 택배 가능 문의" });
    // 정책: 직거래 only 명시가 더 강한 신호 → direct_only
    assert.equal(inferDaangnShipping(a), "direct_only");
  });

  it("detail article (with extra fields) works same as search article", () => {
    const detail: DaangnDetailArticle = {
      ...makeArticle({ content: "택배 가능" }),
      user: {
        dbId: "1",
        nickname: "tester",
        webCrawlNotAllowed: false,
        score: 100,
        reviewCount: 5,
        profileImage: null,
        regionName: "사당동",
      },
      recommendedCount: null,
      commentCount: null,
    };
    assert.equal(inferDaangnShipping(detail), "shipping_possible");
  });
});
