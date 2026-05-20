import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("detail modal keeps product photo compact enough for market evidence", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /aspect-\[4\/3\] max-h-\[42dvh\]/);
  assert.match(modal, /sm:h-\[168px\] sm:w-\[168px\]/);
  assert.match(modal, /lg:h-\[196px\] lg:w-\[196px\]/);
  assert.match(modal, /sm:grid-cols-\[168px_minmax\(0,1fr\)\]/);
  assert.match(modal, /lg:grid-cols-\[196px_minmax\(0,1fr\)\]/);
  assert.match(modal, /sizes="\(max-width: 639px\) 100vw, \(max-width: 1023px\) 168px, 196px"/);
  assert.doesNotMatch(modal, /aspect-\[4\/4\.2\] max-h-\[58dvh\]/);
  assert.doesNotMatch(modal, /sm:h-\[240px\] sm:w-\[240px\]/);
  assert.doesNotMatch(modal, /lg:h-\[280px\] lg:w-\[280px\]/);
});

test("detail modal uses layered image treatment so compact photos are not cropped", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /absolute inset-0 scale-\[1\.03\] opacity-75 blur-\[2px\]/);
  assert.match(modal, /className="object-cover object-center"/);
  assert.match(modal, /absolute inset-0 p-3 sm:p-2/);
  assert.match(modal, /rounded-\[16px\] object-contain object-center/);
  assert.match(modal, /shadow-\[0_12px_24px_rgba\(34,49,39,0\.12\)\] ring-1 ring-black\/8/);
  assert.doesNotMatch(modal, /rounded-none object-cover object-center sm:scale-100/);
});

test("detail modal tones down expected profit typography", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /💎 예상 순익/);
  assert.match(modal, /fontSize: 22, fontWeight: 900/);
  assert.match(modal, /fontSize: 76, fontWeight: 900/);
  assert.match(modal, /padding: "14px 14px 12px"/);
  assert.doesNotMatch(modal, /fontSize: 28, fontWeight: 900, color: isMarketInvalidated/);
  assert.doesNotMatch(modal, /fontSize: 100, fontWeight: 900, color: isMarketInvalidated/);
});
