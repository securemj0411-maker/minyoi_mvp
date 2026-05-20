import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("detail modal keeps product photo immersive without breaking the mobile shell", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /h-\[56dvh\] min-h-\[380px\] max-h-\[560px\]/);
  assert.match(modal, /sizes="\(max-width: 480px\) 100vw, 480px"/);
  assert.match(modal, /sm:w-\[min\(480px,calc\(100vw-32px\)\)\]/);
  assert.match(modal, /sm:max-w-\[480px\]/);
  assert.doesNotMatch(modal, /sm:h-\[240px\] sm:w-\[240px\]/);
  assert.doesNotMatch(modal, /lg:h-\[280px\] lg:w-\[280px\]/);
  assert.doesNotMatch(modal, /sm:grid-cols-\[168px_minmax\(0,1fr\)\]/);
});

test("detail modal uses a single large product image treatment", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const imageBlock = modal.slice(
    modal.indexOf("function RevealProductImage"),
    modal.indexOf("function SkuListingFlowMini"),
  );

  assert.match(imageBlock, /className="object-cover object-center"/);
  assert.match(imageBlock, /크게 보기/);
  assert.match(imageBlock, /absolute bottom-8 left-3/);
  assert.match(imageBlock, /absolute bottom-8 right-3/);
  assert.doesNotMatch(imageBlock, /scale-\[1\.03\] opacity-75 blur-\[2px\]/);
  assert.doesNotMatch(imageBlock, /absolute inset-0 p-3 sm:p-2/);
  assert.doesNotMatch(imageBlock, /rounded-\[16px\] object-contain object-center/);
});

test("detail modal keeps expected profit typography compact and dark-mode aware", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /💎 예상 순익/);
  assert.match(modal, /text-\[22px\] font-black/);
  assert.match(modal, /text-\[76px\] font-black/);
  assert.match(modal, /dark:from-emerald-950\/22 dark:to-zinc-950 dark:shadow-none/);
  assert.match(modal, /dark:bg-zinc-950\/70 dark:text-emerald-200/);
  assert.doesNotMatch(modal, /fontSize: 28, fontWeight: 900, color: isMarketInvalidated/);
  assert.doesNotMatch(modal, /fontSize: 100, fontWeight: 900, color: isMarketInvalidated/);
  assert.doesNotMatch(modal, /padding: "14px 14px 12px"/);
});
