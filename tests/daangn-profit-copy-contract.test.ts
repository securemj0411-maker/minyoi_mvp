import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Daangn profit copy distinguishes zero fee from safety buffer", () => {
  const profit = readFileSync("src/lib/profit.ts", "utf8");
  const modal = readFileSync("src/components/pack-reveal-modal.tsx", "utf8");
  const costPanel = modal.slice(
    modal.indexOf("function CostAssurancePanel"),
    modal.indexOf("function LoadingStage"),
  );

  assert.match(profit, /export function safetyBufferForSource/);
  assert.match(profit, /isDaangnSource\(marketplaceSource\) \? 0 : SAFETY_BUFFER/);
  assert.match(modal, /당근 수수료 0원 · 직거래 기준/);
  assert.match(modal, /네고·이동·거래 불발 리스크는 구매 전 따로 확인하세요/);
  assert.match(costPanel, /if \(isDaangn\) \{\s*return null;\s*\}/);
  assert.doesNotMatch(modal, /당근 수수료 0원 · 안전버퍼/);
  assert.doesNotMatch(modal, /당근 수수료 0원, 안전버퍼/);
});
