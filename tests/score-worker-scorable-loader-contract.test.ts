import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/lib/tick-pipeline.ts", import.meta.url), "utf8");

test("score worker claims scorable pids before hydrating wide raw rows", () => {
  assert.match(source, /select=pid,source\$\{scorableBaseFilter\}/);
  assert.match(source, /buildDirtyScorableRowsByPidUrl/);
  assert.doesNotMatch(
    source,
    /select=\$\{columns\}\$\{scorableBaseFilter\}\$\{extraFilter\}&order=last_seen_at\.desc/,
  );
});

test("score worker splits fashion reserve prefix scans instead of a broad OR scan", () => {
  assert.match(source, /FASHION_SCORE_RESERVE_FILTERS/);
  assert.match(source, /"&sku_id=gte\.shoe-&sku_id=lt\.shoe\."/);
  assert.match(source, /"&sku_id=gte\.clothing-&sku_id=lt\.clothing\."/);
  assert.match(source, /scanLimitMax:\s*40/);
  assert.match(source, /scanLimitMax:\s*10/);
  assert.match(source, /for \(const \{ filter: skuFilter, scanLimitMax \} of FASHION_SCORE_RESERVE_FILTERS\)/);
  assert.doesNotMatch(source, /&or=\(sku_id\.like\.shoe-%2A,sku_id\.like\.clothing-%2A\)/);
  assert.doesNotMatch(source, /"&sku_id=like\.(shoe|clothing)-%2A"/);
});
