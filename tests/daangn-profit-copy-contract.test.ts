import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Daangn profit copy distinguishes zero fee from safety buffer", () => {
  const modal = readFileSync("src/components/pack-reveal-modal.tsx", "utf8");
  assert.match(modal, /당근 수수료 0원 · 안전버퍼 반영/);
  assert.match(modal, /당근 기준 판매 수수료와 재배송비는 0원으로 보고, 안전버퍼/);
  assert.match(modal, /당근 수수료 0원, 안전버퍼/);
  assert.match(modal, /당근 수수료 0원 · 안전버퍼/);
  assert.match(modal, /수익 기준 시세 \$\{snapshot\.salePriceLabel\} − 매입 \$\{snapshot\.buyerCostLabel\} − 안전버퍼/);
});
