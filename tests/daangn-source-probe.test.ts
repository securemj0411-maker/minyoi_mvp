import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDaangnSearchUrl,
  detectDaangnBlockSignal,
  getDaangnSourceMode,
  parseDaangnDetailHtml,
  parseDaangnSearchHtml,
  shouldFetchDaangnDetailCandidate,
  summarizeDaangnArticles,
} from "../src/lib/daangn";

function remixHtml(route: string, loader: unknown): string {
  const json = JSON.stringify({
    state: {
      loaderData: {
        [route]: loader,
      },
    },
  }).replace(/"/g, "&quot;");
  return `<html><body><script>window.__remixContext = ${json};</script></body></html>`;
}

test("daangn source defaults to off and separates probe from active", () => {
  assert.equal(getDaangnSourceMode({}), "off");
  assert.equal(getDaangnSourceMode({ DAANGN_SOURCE_MODE: "probe" }), "probe");
  assert.equal(getDaangnSourceMode({ DAANGN_SOURCE_MODE: "active" }), "active");
  assert.equal(getDaangnSourceMode({ DAANGN_SOURCE_MODE: "enabled" }), "off");
});

test("daangn search URL keeps query form instead of robots-disallowed /s path", () => {
  const url = buildDaangnSearchUrl({
    regionId: "366",
    categoryId: 14,
    search: "나이키 덩크",
  });

  assert.equal(url.startsWith("https://www.daangn.com/kr/buy-sell/?"), true);
  assert.equal(url.includes("/kr/buy-sell/s/"), false);
  assert.equal(url.includes("in=366"), true);
  assert.equal(url.includes("category_id=14"), true);
  assert.equal(url.includes("search="), true);
});

test("daangn block detector treats access denial and rate limit as stop signals", () => {
  assert.deepEqual(detectDaangnBlockSignal({ status: 403 }), {
    blocked: true,
    reason: "http_403_access_denied",
    status: 403,
  });
  assert.deepEqual(detectDaangnBlockSignal({ status: 429 }), {
    blocked: true,
    reason: "http_429_rate_limited",
    status: 429,
  });
  assert.equal(detectDaangnBlockSignal({ status: 200, bodyPreview: "자동화된 접근" }).blocked, true);
  assert.equal(detectDaangnBlockSignal({ status: 200, bodyPreview: "<html>ok</html>" }).blocked, false);
});

test("daangn search parser extracts Remix articles and freshness summary", () => {
  const nowMs = Date.parse("2026-05-25T12:00:00.000Z");
  const html = remixHtml("routes/kr.buy-sell._index", {
    currentFilters: { regionId: "366", categoryId: "14", search: "나이키 덩크" },
    allPage: {
      fleamarketArticles: [
        {
          id: "/kr/buy-sell/a/",
          href: "https://www.daangn.com/kr/buy-sell/a/",
          title: "나이키 덩크 로우",
          price: "68000.0",
          status: "Ongoing",
          content: "실착 적음",
          createdAt: "2026-05-24T11:00:00.000+09:00",
          boostedAt: "2026-05-25T20:00:00.000+09:00",
          user: { dbId: "u1", nickname: "seller", webCrawlNotAllowed: false },
          region: { dbId: "366", name: "서초4동" },
          category: { dbId: "14", name: "남성패션/잡화" },
        },
        {
          id: "/kr/buy-sell/b/",
          href: "https://www.daangn.com/kr/buy-sell/b/",
          title: "나이키 덩크 박스",
          price: "1000.0",
          status: "Closed",
          createdAt: "2026-05-20T11:00:00.000+09:00",
          boostedAt: "2026-05-20T11:00:00.000+09:00",
          user: { dbId: "u2", nickname: "closed", webCrawlNotAllowed: false },
          region: { dbId: "366", name: "서초4동" },
          category: { dbId: "14", name: "남성패션/잡화" },
        },
      ],
    },
  });

  const parsed = parseDaangnSearchHtml(html);
  assert.equal(parsed.currentFilters.regionId, "366");
  assert.equal(parsed.currentFilters.categoryId, "14");
  assert.equal(parsed.articles.length, 2);
  assert.equal(parsed.articles[0]?.price, 68000);

  const summary = summarizeDaangnArticles(parsed.articles, {
    freshWindowHours: 24,
    activeWindowHours: 72,
    staleBoostedDays: 21,
    nowMs,
  });
  assert.equal(summary.total, 2);
  assert.equal(summary.ongoing, 1);
  assert.equal(summary.closed, 1);
  assert.equal(summary.freshBoosted24h, 1);
  assert.equal(summary.activeBoosted72h, 1);
  assert.equal(summary.samples[0]?.title, "나이키 덩크 로우");
});

test("daangn search parser restores firehose category from thumbnail digest", () => {
  const html = remixHtml("routes/kr.buy-sell._index", {
    currentFilters: { regionId: "6035" },
    allPage: {
      fleamarketArticles: [
        {
          id: "/kr/buy-sell/a/",
          href: "https://www.daangn.com/kr/buy-sell/a/",
          title: "정품 AMD 라이젠5 1400 CPU + 쿨러",
          price: "30000.0",
          status: "Ongoing",
          createdAt: "2026-05-24T11:00:00.000+09:00",
          boostedAt: "2026-05-25T20:00:00.000+09:00",
          user: { dbId: "u1", nickname: "seller", webCrawlNotAllowed: false },
          region: { dbId: "6035", name: "역삼동" },
          category: {
            thumbnail: "https://dnvefa72aowie.cloudfront.net/origin/category/202306/2c0811ac0c0f491039082d246cd41de636d58cd6e54368a0b012c386645d7c66.png?service=webapp&f=webp",
          },
        },
      ],
    },
  });

  const parsed = parseDaangnSearchHtml(html);
  assert.equal(parsed.articles[0]?.category.dbId, "1");
  assert.equal(parsed.articles[0]?.category.name, "디지털기기");
});

test("daangn search parser falls back to current category filter when article category is sparse", () => {
  const html = remixHtml("routes/kr.buy-sell._index", {
    currentFilters: { regionId: "6035", categoryId: "14" },
    allPage: {
      fleamarketArticles: [
        {
          id: "/kr/buy-sell/a/",
          href: "https://www.daangn.com/kr/buy-sell/a/",
          title: "밀레 남성 폴로티",
          price: "10000.0",
          status: "Ongoing",
          user: { dbId: "u1", nickname: "seller", webCrawlNotAllowed: false },
          region: { dbId: "6035", name: "역삼동" },
          category: { __typename: "FleamarketCategory" },
        },
      ],
    },
  });

  const parsed = parseDaangnSearchHtml(html);
  assert.equal(parsed.articles[0]?.category.dbId, "14");
  assert.equal(parsed.articles[0]?.category.name, "남성패션/잡화");
});

test("daangn detail candidates require ongoing, crawl-allowed, active bumped rows", () => {
  const nowMs = Date.parse("2026-05-25T12:00:00.000Z");
  const base = {
    id: "a",
    href: "https://www.daangn.com/kr/buy-sell/a/",
    title: "나이키 덩크",
    price: 68000,
    status: "Ongoing",
    content: null,
    thumbnail: null,
    createdAt: "2026-05-25T10:00:00.000Z",
    boostedAt: "2026-05-25T10:00:00.000Z",
    favoriteCount: null,
    chatCount: null,
    viewCount: null,
    region: { dbId: "366", name: "서초4동" },
    category: { dbId: "14", name: "남성패션/잡화" },
    user: { dbId: "u1", nickname: "seller", webCrawlNotAllowed: false },
  };

  assert.equal(shouldFetchDaangnDetailCandidate(base, { activeWindowHours: 72, nowMs }), true);
  assert.equal(shouldFetchDaangnDetailCandidate({ ...base, status: "Closed" }, { activeWindowHours: 72, nowMs }), false);
  assert.equal(
    shouldFetchDaangnDetailCandidate({
      ...base,
      user: { ...base.user, webCrawlNotAllowed: true },
    }, { activeWindowHours: 72, nowMs }),
    false,
  );
  assert.equal(
    shouldFetchDaangnDetailCandidate({
      ...base,
      boostedAt: "2026-05-01T10:00:00.000Z",
    }, { activeWindowHours: 72, nowMs }),
    false,
  );
});

test("daangn detail parser extracts seller score and engagement fields", () => {
  const html = remixHtml("routes/kr.buy-sell.$slug", {
    article: {
      id: "/kr/buy-sell/a/",
      href: "https://www.daangn.com/kr/buy-sell/a/",
      title: "나이키 덩크 로우",
      price: "68000.0",
      status: "Ongoing",
      content: "밑창 보시면 신고 나가본 적 없습니다",
      createdAt: "2026-05-24T11:00:00.000+09:00",
      boostedAt: "2026-05-25T20:00:00.000+09:00",
      favoriteCount: 7,
      chatCount: 1,
      viewCount: 91,
      region: { dbId: "366", name: "서초4동" },
      category: { dbId: "14", name: "남성패션/잡화" },
      user: {
        dbId: "u1",
        nickname: "seller",
        score: 46.3,
        reviewCount: 41,
        profileImage: "https://example.com/profile.png",
        webCrawlNotAllowed: false,
        region: { name: "서초4동" },
      },
      recommendedArticles: [{ id: "r1" }, { id: "r2" }],
      comments: [],
    },
  });

  const parsed = parseDaangnDetailHtml(html);

  assert.equal(parsed?.title, "나이키 덩크 로우");
  assert.equal(parsed?.favoriteCount, 7);
  assert.equal(parsed?.chatCount, 1);
  assert.equal(parsed?.viewCount, 91);
  assert.equal(parsed?.user.score, 46.3);
  assert.equal(parsed?.user.reviewCount, 41);
  assert.equal(parsed?.recommendedCount, 2);
  assert.equal(parsed?.commentCount, 0);
});
