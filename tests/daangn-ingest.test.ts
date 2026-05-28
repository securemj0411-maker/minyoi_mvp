// Daangn ingest module — pure logic tests (no network, no DB).
//
// runDaangnIngest 자체는 fetch 의존이라 통합 테스트는 별도 (probe 스크립트 활용).
// 여기는 selectDaangnCombos / inferDaangnShipping / age bucket 등 pure helper.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  daangnUpsertPreflightLimit,
  hasDaangnDetailPayload,
  inferDaangnShipping,
  selectDaangnCategoryBoostCombos,
  selectDaangnCombos,
  selectDaangnFirehoseCombos,
  selectDaangnRegionShard,
} from "../src/lib/daangn-ingest";
import {
  DAANGN_FASHION_CATEGORIES,
  DEFAULT_DAANGN_FASHION_QUERY_SEEDS,
  DEFAULT_DAANGN_REGION_SEEDS,
  daangnLifecycleFromStatus,
  daangnInternalPid,
  parseDaangnExternalId,
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

describe("selectDaangnFirehoseCombos", () => {
  const regions = [
    { id: "r1", name: "R1" },
    { id: "r2", name: "R2" },
    { id: "r3", name: "R3" },
    { id: "r4", name: "R4" },
    { id: "r5", name: "R5" },
  ];

  it("marks full-region fetches as all_regions", () => {
    const result = selectDaangnFirehoseCombos({
      regions,
      maxRegions: regions.length,
      shuffleRegions: false,
    });
    assert.equal(result.combos.length, regions.length);
    assert.equal(result.selectionMode, "all_regions");
  });

  it("uses recent region scores when maxRegions is lower than region count", () => {
    const result = selectDaangnFirehoseCombos({
      regions,
      maxRegions: 3,
      shuffleRegions: false,
      explorationRatio: 0.34,
      regionScores: new Map([
        ["r4", 100],
        ["r2", 50],
        ["r5", 1],
      ]),
    });
    assert.equal(result.selectionMode, "adaptive");
    assert.deepEqual(result.combos.map((combo) => combo.region.id), ["r4", "r2", "r1"]);
  });
});

describe("selectDaangnRegionShard", () => {
  const regions = [
    { id: "r1", name: "R1" },
    { id: "r2", name: "R2" },
    { id: "r3", name: "R3" },
    { id: "r4", name: "R4" },
    { id: "r5", name: "R5" },
    { id: "r6", name: "R6" },
  ];

  it("splits regions into stable disjoint shards", () => {
    const a = selectDaangnRegionShard(regions, 2, 0);
    const b = selectDaangnRegionShard(regions, 2, 1);
    const aIds = new Set(a.map((region) => region.id));
    const bIds = new Set(b.map((region) => region.id));
    assert.ok(a.length > 0);
    assert.ok(b.length > 0);
    assert.equal(a.filter((region) => bIds.has(region.id)).length, 0);
    assert.equal(b.filter((region) => aIds.has(region.id)).length, 0);
    assert.equal(new Set([...aIds, ...bIds]).size, regions.length);
  });

  it("keeps all regions when shard count is one", () => {
    assert.deepEqual(selectDaangnRegionShard(regions, 1, 0), regions);
  });
});

describe("selectDaangnCategoryBoostCombos", () => {
  const regions = [
    { id: "r1", name: "R1" },
    { id: "r2", name: "R2" },
    { id: "r3", name: "R3" },
  ];
  const categories = [
    { id: 1, name: "디지털기기" },
    { id: 14, name: "남성패션/잡화" },
  ];

  it("adds category-depth combos only for the requested top regions", () => {
    const result = selectDaangnCategoryBoostCombos({
      regions,
      categories,
      maxRegions: 2,
      shuffleRegions: false,
      regionScores: new Map([
        ["r3", 100],
        ["r1", 50],
      ]),
    });
    assert.equal(result.combos.length, 4);
    assert.equal(result.totalSpace, 6);
    assert.equal(result.selectionMode, "adaptive");
    assert.deepEqual(result.combos.map((combo) => `${combo.region.id}:${combo.category.id}`), [
      "r3:1",
      "r3:14",
      "r1:1",
      "r1:14",
    ]);
  });

  it("uses learned region-category pair scores before broad region scores", () => {
    const result = selectDaangnCategoryBoostCombos({
      regions,
      categories,
      maxRegions: 1,
      shuffleRegions: false,
      regionScores: new Map([["r1", 100]]),
      pairScores: new Map([["r3:14", 999]]),
      explorationRatio: 0,
    });
    assert.deepEqual(result.combos.map((combo) => `${combo.region.id}:${combo.category.id}`), [
      "r3:14",
      "r1:1",
    ]);
  });
});

describe("daangnUpsertPreflightLimit", () => {
  it("checks a wider candidate window without raising the write cap", () => {
    assert.equal(daangnUpsertPreflightLimit(500, 5000), 5000);
    assert.equal(daangnUpsertPreflightLimit(500, 700), 700);
    assert.equal(daangnUpsertPreflightLimit(800, 5000), 5000);
  });

  it("keeps zero caps disabled", () => {
    assert.equal(daangnUpsertPreflightLimit(0, 5000), 0);
    assert.equal(daangnUpsertPreflightLimit(500, 0), 0);
  });
});

describe("daangnLifecycleFromStatus", () => {
  it("keeps only Ongoing active and blocks Reserved/Closed from ready", () => {
    assert.deepEqual(daangnLifecycleFromStatus("Ongoing"), {
      listingState: "active",
      saleStatus: "selling",
      reason: "active",
    });
    assert.deepEqual(daangnLifecycleFromStatus("Reserved"), {
      listingState: "disappeared",
      saleStatus: "reserved",
      reason: "reserved",
    });
    assert.deepEqual(daangnLifecycleFromStatus("Closed"), {
      listingState: "sold_confirmed",
      saleStatus: "closed",
      reason: "closed",
    });
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

  it("daangnInternalPid is deterministic + in 9_000_000_000_000+ namespace", () => {
    const ext = "나이키-덩크-로우-범고래-275mm-m6kfak8ich21";
    const pid1 = daangnInternalPid(ext);
    const pid2 = daangnInternalPid(ext);
    assert.equal(pid1, pid2, "deterministic for same input");
    assert.ok(pid1 >= 9_000_000_000_000, "in daangn pid namespace");
    assert.ok(pid1 < 10_000_000_000_000, "below 10 trillion (32-bit hash range)");
  });

  it("daangnInternalPid different for different externalIds", () => {
    const a = daangnInternalPid("article-a-m1");
    const b = daangnInternalPid("article-b-m2");
    assert.notEqual(a, b);
  });

  it("daangnInternalPid throws on empty", () => {
    assert.throws(() => daangnInternalPid(""), /empty externalId/);
  });

  it("parseDaangnExternalId extracts slug from /kr/buy-sell/<slug>/", () => {
    assert.equal(
      parseDaangnExternalId("/kr/buy-sell/나이키-덩크-275-m6kfak8ich21/"),
      "나이키-덩크-275-m6kfak8ich21",
    );
    assert.equal(
      parseDaangnExternalId("https://www.daangn.com/kr/buy-sell/abc-xyz123/"),
      "abc-xyz123",
    );
    assert.equal(parseDaangnExternalId("/invalid-path/"), null);
    assert.equal(parseDaangnExternalId(""), null);
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

describe("hasDaangnDetailPayload", () => {
  it("does not treat search-only seller profile fields as detail enrichment", () => {
    const searchLike = makeArticle({
      user: {
        dbId: "1",
        nickname: "tester",
        webCrawlNotAllowed: false,
        profileImage: "https://example.com/profile.png",
        regionName: "사당동",
      } as DaangnSearchArticle["user"],
    });
    assert.equal(hasDaangnDetailPayload(searchLike), false);
  });

  it("recognizes parsed detail payloads that can carry manner temperature", () => {
    const detail: DaangnDetailArticle = {
      ...makeArticle({ content: "택배 가능" }),
      user: {
        dbId: "1",
        nickname: "tester",
        webCrawlNotAllowed: false,
        score: 43.3,
        reviewCount: 26,
        profileImage: null,
        regionName: "사당동",
      },
      recommendedCount: null,
      commentCount: 0,
    };
    assert.equal(hasDaangnDetailPayload(detail), true);
  });
});
