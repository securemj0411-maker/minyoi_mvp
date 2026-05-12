import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportDir = path.join(appDir, "reports");

function num(value) {
  return Math.round(Number(value) || 0).toLocaleString("ko-KR");
}

function pct(part, total, digits = 1) {
  const p = Number(part) || 0;
  const t = Number(total) || 0;
  if (!t) return "0%";
  return `${((p / t) * 100).toFixed(digits)}%`;
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

const sourcePath = path.join(reportDir, "query-cadence-simulator-latest.json");
const raw = JSON.parse(await readFile(sourcePath, "utf-8"));
const scenario = raw?.scenarios?.relaxedGather;
if (!scenario) {
  throw new Error("query-cadence-simulator-latest.json에 relaxedGather 시나리오가 없습니다.");
}

const gatherRows = scenario.queryRows.filter((row) => row.mode === "gather");
const keep5m = gatherRows
  .filter((row) => row.cadence === "5m")
  .sort((a, b) => b.observed - a.observed)
  .slice(0, 15);
const move10m = gatherRows
  .filter((row) => row.cadence === "10m")
  .sort((a, b) => b.observed - a.observed)
  .slice(0, 20);
const move30m = gatherRows
  .filter((row) => row.cadence === "30m")
  .sort((a, b) => b.observed - a.observed)
  .slice(0, 20);
const move60m = gatherRows
  .filter((row) => row.cadence === "60m")
  .sort((a, b) => b.observed - a.observed)
  .slice(0, 20);

const byReason = new Map();
for (const row of gatherRows) {
  const current = byReason.get(row.reason) ?? { reason: row.reason, queries: 0, observed: 0, changed: 0 };
  current.queries += 1;
  current.observed += Number(row.observed) || 0;
  current.changed += Number(row.changed) || 0;
  byReason.set(row.reason, current);
}

const reasonRows = [...byReason.values()].sort((a, b) => b.observed - a.observed);

const summary = {
  generatedAt: new Date().toISOString(),
  sourceGeneratedAt: raw.generatedAt,
  windowHours: raw.windowHours,
  gatherRowCount: gatherRows.length,
  keep5mCount: keep5m.length,
  move10mCount: move10m.length,
  move30mCount: move30m.length,
  move60mCount: move60m.length,
  reasonRows,
  keep5m,
  move10m,
  move30m,
  move60m,
};

const markdown = `# Relaxed Gather Candidates

- generated_at: ${summary.generatedAt}
- source_generated_at: ${summary.sourceGeneratedAt}
- window: 최근 ${summary.windowHours}시간
- mode: read-only / no runtime change
- source: \`query-cadence-simulator-latest.json\` 의 \`relaxedGather\` 시나리오

## 요약

- gather query groups: ${num(gatherRows.length)}
- 5m 유지 그룹: ${num(summary.keep5mCount)}
- 10m 완화 그룹: ${num(summary.move10mCount)}
- 30m 완화 그룹: ${num(summary.move30mCount)}
- 60m 완화 그룹: ${num(summary.move60mCount)}

## Reason 분포

${table(
  ["reason", "query groups", "observed rows", "changed rows", "change rate"],
  reasonRows.map((row) => [
    row.reason,
    num(row.queries),
    num(row.observed),
    num(row.changed),
    pct(row.changed, row.observed),
  ]),
)}

## 5m 유지해야 하는 gather 상위군

${table(
  ["query", "family", "readiness", "reason", "observed", "changed", "detail done", "pool any"],
  keep5m.map((row) => [
    row.query,
    row.family,
    row.readinessStatus,
    row.reason,
    num(row.observed),
    `${num(row.changed)} (${pct(row.changed, row.observed)})`,
    num(row.detailsDone),
    num(row.poolAny),
  ]),
)}

## 10m 완화 후보 상위군

${table(
  ["query", "family", "readiness", "reason", "observed", "changed", "detail done", "pool any"],
  move10m.map((row) => [
    row.query,
    row.family,
    row.readinessStatus,
    row.reason,
    num(row.observed),
    `${num(row.changed)} (${pct(row.changed, row.observed)})`,
    num(row.detailsDone),
    num(row.poolAny),
  ]),
)}

## 30m 완화 후보 상위군

${table(
  ["query", "family", "readiness", "reason", "observed", "changed", "detail done", "pool any"],
  move30m.map((row) => [
    row.query,
    row.family,
    row.readinessStatus,
    row.reason,
    num(row.observed),
    `${num(row.changed)} (${pct(row.changed, row.observed)})`,
    num(row.detailsDone),
    num(row.poolAny),
  ]),
)}

## 60m 완화 후보 상위군

${table(
  ["query", "family", "readiness", "reason", "observed", "changed", "detail done", "pool any"],
  move60m.map((row) => [
    row.query,
    row.family,
    row.readinessStatus,
    row.reason,
    num(row.observed),
    `${num(row.changed)} (${pct(row.changed, row.observed)})`,
    num(row.detailsDone),
    num(row.poolAny),
  ]),
)}

## 판단

1. ready category는 여기서 다루지 않는다. 이 리포트는 gather query만 본다.
2. \`gather_sample_build_*\`는 표본/상세가 아직 얕아서 5m 유지 쪽이 맞다.
3. \`gather_high_change_*\`는 첫 완화 후보로 10m가 자연스럽다.
4. 이 리포트만으로 runtime cadence를 바꾸지 않는다. 다음 단계는 registry/cadence gate dry-run 설계다.
`;

const outPath = path.join(reportDir, "relaxed-gather-candidates-latest.md");
const jsonPath = path.join(reportDir, "relaxed-gather-candidates-latest.json");

await mkdir(reportDir, { recursive: true });
await writeFile(outPath, markdown);
await writeFile(jsonPath, JSON.stringify(summary, null, 2));

console.log(`wrote ${outPath}`);
