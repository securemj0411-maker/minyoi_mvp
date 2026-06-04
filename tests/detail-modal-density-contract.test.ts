import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("detail modal keeps product photo immersive without breaking the mobile shell", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /relative flex w-full items-center justify-center overflow-hidden bg-\[#eee7da\]/);
  assert.match(modal, /style=\{\{ minHeight: 280, maxHeight: "60dvh" \}\}/);
  assert.match(modal, /className="h-auto w-auto max-h-\[60dvh\] max-w-full object-contain"/);
  assert.match(modal, /loading="eager"/);
  assert.match(modal, /decoding="async"/);
  assert.match(modal, /sm:w-\[min\(560px,calc\(100vw-32px\)\)\]/);
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

  assert.match(imageBlock, /className="h-auto w-auto max-h-\[60dvh\] max-w-full object-contain"/);
  assert.match(imageBlock, /className="object-contain object-center"/);
  assert.match(imageBlock, /크게 보기/);
  assert.match(imageBlock, /absolute bottom-8 left-3/);
  assert.match(imageBlock, /absolute bottom-8 right-3/);
  assert.doesNotMatch(imageBlock, /scale-\[1\.03\] opacity-75 blur-\[2px\]/);
  assert.doesNotMatch(imageBlock, /absolute inset-0 p-3 sm:p-2/);
  assert.doesNotMatch(imageBlock, /rounded-\[16px\] object-contain object-center/);
});

test("detail modal keeps expected profit typography compact and dark-mode aware", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, />예상 순익<\/span>/);
  assert.match(modal, /text-\[22px\] font-black/);
  assert.match(modal, /text-\[76px\] font-black/);
  assert.match(modal, /dark:from-blue-950\/22 dark:to-zinc-950 dark:shadow-none/);
  assert.match(modal, /text-emerald-700 dark:text-emerald-300/);
  assert.doesNotMatch(modal, /fontSize: 28, fontWeight: 900, color: isMarketInvalidated/);
  assert.doesNotMatch(modal, /fontSize: 100, fontWeight: 900, color: isMarketInvalidated/);
  assert.doesNotMatch(modal, /padding: "14px 14px 12px"/);
});

test("detail modal compacts source, condition, and location into one Korean meta line", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const heroBlock = modal.slice(
    modal.indexOf("const headerMetaParts = ["),
    modal.indexOf("<PurchaseDecisionHeader card={card} />"),
  );

  assert.match(modal, /function compactTradeLocationLabel/);
  assert.match(modal, /function revealHeaderConditionLabel/);
  assert.match(modal, /const headerMetaParts = \[/);
  assert.match(modal, /\{marketplaceLabelForCard\(card\)\} · \$\{headerConditionLabel \?\? "상태 확인"\} · \$\{directTradeLocation\}/);
  assert.match(heroBlock, /text-\[12px\] font-black leading-5/);
  assert.doesNotMatch(heroBlock, /MarketplaceSourceBadge/);
  assert.doesNotMatch(heroBlock, /거래 가능 동네:/);
  assert.doesNotMatch(heroBlock, /<ConditionTierChip/);
});
