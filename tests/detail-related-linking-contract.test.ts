import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

function between(text: string, start: string, end: string) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex);
  assert.ok(startIndex >= 0, `missing start marker: ${start}`);
  assert.ok(endIndex > startIndex, `missing end marker: ${end}`);
  return text.slice(startIndex, endIndex);
}

test("detail comparable rows open the original listing from the whole row", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const comparablePanel = between(modal, "function ComparableListingsPanel", "function UpperFoldFearReducers");

  assert.match(comparablePanel, /const sourceUrl = item\.listingUrl \|\| item\.bunjangUrl/);
  assert.match(comparablePanel, /<a\s+[\s\S]*href=\{sourceUrl\}[\s\S]*target="_blank"[\s\S]*className="group flex min-h-\[74px\]/);
  assert.match(comparablePanel, /원문 열기/);
  assert.doesNotMatch(comparablePanel, /원문 보기/);
});

test("detail related strip does not reuse feed teaser masking", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const relatedStrip = between(modal, "function RelatedRevealStrip", "function DetailReportModeChoiceSheet");

  assert.doesNotMatch(relatedStrip, /item\.locked === true/);
  assert.doesNotMatch(relatedStrip, /blur-\[2px\]|scale-105|상세에서 공개|상세에서 확인/);
  assert.match(relatedStrip, /className="object-cover"/);
  assert.match(relatedStrip, /profitRange\(item\.expectedProfitMin, item\.expectedProfitMax\)/);
  assert.match(relatedStrip, /매입 \{krw\(item\.price\)\} · \+\{profitPct\}%/);
});
