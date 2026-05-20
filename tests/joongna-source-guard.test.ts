import assert from "node:assert/strict";
import test from "node:test";

import {
  detectJoongnaBlockSignal,
  extractSitemapLocs,
  getJoongnaSourceMode,
  joongnaInternalPid,
  parseJoongnaProductExternalId,
  parseRobotsTxt,
} from "../src/lib/joongna";

test("joongna source defaults to off and only accepts explicit shadow or active", () => {
  assert.equal(getJoongnaSourceMode({}), "off");
  assert.equal(getJoongnaSourceMode({ JOONGNA_SOURCE_MODE: "shadow" }), "shadow");
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
