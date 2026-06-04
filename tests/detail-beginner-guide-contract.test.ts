import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("detail modal no longer exposes easy mode as a separate user surface", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /const guideModeActive = false/);
  assert.match(modal, /<SellerTrustPanel card=\{card\} \/>/);
  assert.match(modal, /data-seller-trust-panel/);
  assert.doesNotMatch(modal, /data-beginner-guide-reopen/);
  assert.doesNotMatch(modal, /onBeginnerGuideClick=\{/);
  assert.doesNotMatch(modal, />쉽게 보기<\/span>/);
});

test("detail modal prioritizes hard evidence order", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const profitIndex = modal.indexOf(">예상 순익</span>");
  const upperFoldIndex = modal.indexOf("<UpperFoldFearReducers card={card} analysisLoading={analysisLoading} />");
  const sellerIndex = modal.indexOf("<SellerTrustPanel card={card} />");
  const comparableIndex = modal.indexOf("<ComparableListingsPanel card={card} mode={mode} />");
  const graphIndex = modal.indexOf("<DetailMarketGraphSection card={card} />");

  assert.ok(profitIndex > 0, "profit should be the first major decision block");
  assert.ok(upperFoldIndex > profitIndex, "speed/risk summary should follow money");
  assert.ok(sellerIndex > upperFoldIndex, "seller trust should stay near the top");
  assert.ok(comparableIndex > sellerIndex, "concrete comparable listings should precede chart evidence");
  assert.ok(graphIndex > comparableIndex, "market graph should render after comparable listings");
  assert.doesNotMatch(modal, /<PurchaseDecisionHeader card=\{card\} \/>/);
});
