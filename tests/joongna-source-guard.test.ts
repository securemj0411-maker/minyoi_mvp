import assert from "node:assert/strict";
import test from "node:test";

import {
  detectJoongnaBlockSignal,
  extractSitemapLocs,
  getJoongnaSourceMode,
  joongnaInternalPid,
  parseJoongnaDetailHtml,
  parseJoongnaProductExternalId,
  parseRobotsTxt,
} from "../src/lib/joongna";

test("joongna source defaults to off and only accepts explicit active", () => {
  assert.equal(getJoongnaSourceMode({}), "off");
  assert.equal(getJoongnaSourceMode({ JOONGNA_SOURCE_MODE: "shadow" }), "off");
  assert.equal(getJoongnaSourceMode({ JOONGNA_SOURCE_MODE: "active" }), "active");
  assert.equal(getJoongnaSourceMode({ JOONGNA_SOURCE_MODE: "enabled" }), "off");
});

test("joongna block detector treats access denial and rate limit as stop signals", () => {
  assert.deepEqual(detectJoongnaBlockSignal({ status: 403 }), {
    blocked: true,
    reason: "http_403_access_denied",
    status: 403,
  });
  assert.deepEqual(detectJoongnaBlockSignal({ status: 429 }), {
    blocked: true,
    reason: "http_429_rate_limited",
    status: 429,
  });
  assert.equal(detectJoongnaBlockSignal({ status: 200, bodyPreview: "비정상적인 접근입니다" }).blocked, true);
  assert.equal(detectJoongnaBlockSignal({ status: 200, bodyPreview: "<html>ok</html>" }).blocked, false);
});

test("joongna robots and sitemap parsers keep only crawl entry metadata", () => {
  const robots = parseRobotsTxt(`
User-agent: *
Disallow: /my-account
Allow: /
Sitemap: https://web.joongna.com/sitemap-recent-product-index.xml.gz
`);
  assert.deepEqual(robots.disallow, ["/my-account"]);
  assert.deepEqual(robots.sitemaps, ["https://web.joongna.com/sitemap-recent-product-index.xml.gz"]);

  assert.deepEqual(extractSitemapLocs(`
<urlset>
  <url><loc>https://web.joongna.com/product/12345</loc></url>
  <url><loc>https://web.joongna.com/product/12345</loc></url>
  <url><loc>http://example.invalid/not-kept</loc></url>
</urlset>
`), ["https://web.joongna.com/product/12345"]);
});

test("joongna external ids map to deterministic non-bunjang internal pid range", () => {
  const first = joongnaInternalPid("12345");
  const second = joongnaInternalPid("12345");
  const other = joongnaInternalPid("67890");
  assert.equal(first, second);
  assert.notEqual(first, other);
  assert.ok(first >= 7_000_000_000_000);
  assert.ok(Number.isSafeInteger(first));
  assert.equal(parseJoongnaProductExternalId("https://web.joongna.com/product/12345?foo=1"), "12345");
});

test("joongna detail parser extracts Next payload fields", () => {
  const html = `
    <html><head>
      <meta property="og:title" content="fallback title"/>
      <meta property="og:image" content="https://img2.joongna.com/media/original/test.jpg?impolicy=thumb&amp;size=150"/>
    </head><body>
      <script>self.__next_f.push([1,"22:[\\"$\\",\\"$L38\\",null,{\\"product\\":{\\"productSeq\\":228819554,\\"storeSeq\\":12384868,\\"nickName\\":\\"폰가비\\",\\"productTitle\\":\\"미개봉 애플 에어팟 맥스2(USB-C) 미드나잇\\",\\"productDescription\\":\\"애플 에어팟 맥스 미개봉 제품입니다.\\\\n좋아요\\",\\"productStatus\\":0,\\"categoryName\\":\\"가전제품,음향가전,이어폰/헤드폰\\",\\"categorySeq\\":\\"7,153,1171\\",\\"productPrice\\":540000,\\"parcelFeeYn\\":1,\\"productTradeType\\":5,\\"viewCount\\":12,\\"labels\\":[\\"직거래\\",\\"배송비 포함\\"],\\"sortDate\\":\\"2026-05-21 08:56:29\\",\\"updateDate\\":\\"2026-05-21 08:56:30\\"}}]\\n"])</script>
    </body></html>
  `;

  const parsed = parseJoongnaDetailHtml("https://web.joongna.com/product/228819554", html, 200);

  assert.equal(parsed.externalId, "228819554");
  assert.equal(parsed.internalPid, joongnaInternalPid("228819554"));
  assert.equal(parsed.title, "미개봉 애플 에어팟 맥스2(USB-C) 미드나잇");
  assert.equal(parsed.description, "애플 에어팟 맥스 미개봉 제품입니다.\n좋아요");
  assert.equal(parsed.price, 540000);
  assert.equal(parsed.productStatus, 0);
  assert.equal(parsed.categoryName, "가전제품,음향가전,이어폰/헤드폰");
  assert.equal(parsed.parcelFeeYn, 1);
  assert.equal(parsed.storeSeq, 12384868);
  assert.equal(parsed.nickName, "폰가비");
  assert.equal(parsed.viewCount, 12);
  assert.equal(parsed.sourceUpdatedAt, "2026-05-20T23:56:30.000Z");
  assert.deepEqual(parsed.labels, ["직거래", "배송비 포함"]);
});

test("joongna detail parser keeps multiple direct-trade locations", () => {
  const html = `
    <html><body>
      <script>self.__next_f.push([1,"22:[\\"$\\",\\"$L38\\",null,{\\"product\\":{\\"productSeq\\":229000111,\\"productTitle\\":\\"Seiko Prospex SPB103J1\\",\\"productStatus\\":0,\\"productPrice\\":680000,\\"productTradeType\\":4,\\"locations\\":[{\\"locationName\\":\\"원천동\\"},{\\"locationName\\":\\"영통1동\\"},{\\"locationName\\":\\"청담동\\"}]}}]\\n"])</script>
    </body></html>
  `;

  const parsed = parseJoongnaDetailHtml("https://web.joongna.com/product/229000111", html, 200);

  assert.equal(parsed.tradeLocation, "원천동 · 영통1동 · 청담동");
});
