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
  assert.match(chart, /const soldPath = hasSoldHistory \? linePath\(\(p\) => \(p\.soldCount > 0 \? p\.sold : null\)\) : ""/);
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

test("market history hides sold series when no sold samples exist", () => {
  const chart = source("src/components/market-history-chart.tsx");

  assert.match(chart, /const hasSoldHistory = data\.some/);
  assert.match(chart, /p\.soldCount > 0 && p\.sold != null/);
  assert.match(chart, /\{hasSoldHistory \? \(/);
  assert.match(chart, /hasSoldHistory \? `\$\{marketLabel\} 시세 \$\{daysSpan\}일 추이` : `\$\{marketLabel\} 호가 \$\{daysSpan\}일 추이`/);
  assert.doesNotMatch(chart, /거래 0건 — 호가 추정/);
});

test("market history chart animates line drawing without breaking reduced motion", () => {
  const chart = source("src/components/market-history-chart.tsx");

  assert.match(chart, /@keyframes minyoiChartDraw/);
  assert.match(chart, /@keyframes minyoiChartScaleX/);
  assert.match(chart, /@keyframes minyoiChartPop/);
  assert.match(chart, /prefers-reduced-motion: reduce/);
  assert.match(chart, /pathLength=\{1\}/);
  assert.match(chart, /className="minyoi-chart-line"/);
  assert.match(chart, /className="minyoi-chart-line minyoi-chart-line--sold"/);
  assert.match(chart, /className="minyoi-chart-price-line"/);
  assert.match(chart, /className="minyoi-chart-pop"/);
});
