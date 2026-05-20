import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("market history line paths start at the first available non-null point", () => {
  const chart = source("src/components/market-history-chart.tsx");

  assert.match(chart, /let pathStarted = false/);
  assert.match(chart, /const command = pathStarted \? "L" : "M"/);
  assert.match(chart, /pathStarted = true/);
  assert.match(chart, /const activePath = linePath\(\(p\) => p\.active\)/);
  assert.match(chart, /const soldPath = linePath\(\(p\) => p\.sold\)/);
  assert.doesNotMatch(chart, /i === 0 \? "M" : "L"/);
});

test("market history x-axis labels the full timeline, not only sold dates", () => {
  const chart = source("src/components/market-history-chart.tsx");

  assert.match(chart, /const xAxisTicks = \(\(\) =>/);
  assert.match(chart, /indexes\.add\(Math\.round\(\(step \* lastIndex\) \/ \(maxLabels - 1\)\)\)/);
  assert.match(chart, /전체 기간 X축 라벨/);
  assert.match(chart, /shortDateLabel\(s\.date\)/);
  assert.match(chart, /key=\{`sold-\$\{p\.date\}`\}/);
  assert.doesNotMatch(chart, /const soldDays = data/);
  assert.doesNotMatch(chart, /거래 날짜 X축 라벨/);
});
