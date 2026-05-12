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
const source = JSON.parse(await readFile(sourcePath, "utf-8"));
const scenario = source?.scenarios?.relaxedGather;
if (!scenario) {
  throw new Error("query-cadence-simulator-latest.json에 relaxedGather 시나리오가 없습니다.");
}

const sampleBuildRows = scenario.queryRows
  .filter((row) => row.reason === "gather_sample_build_internal_only")
  .sort((a, b) => b.observed - a.observed);

const packet = sampleBuildRows.map((row) => ({
  query: row.query,
  family: row.family,
  readiness: row.readinessStatus,
  observed: row.observed,
  changed: row.changed,
  active: row.active,
  normalType: row.normalType,
  detailsDone: row.detailsDone,
  detailsPending: row.detailsPending,
  poolAny: row.poolAny,
  poolReady: row.poolReady,
  changeRate: row.observed ? row.changed / row.observed : 0,
  detailDoneRate: row.observed ? row.detailsDone / row.observed : 0,
  normalTypeRate: row.observed ? row.normalType / row.observed : 0,
}));

const markdown = `# Gather Sample Build Packet

- generated_at: ${new Date().toISOString()}
- source_generated_at: ${source.generatedAt}
- window: 최근 ${source.windowHours}시간
- mode: read-only / no runtime change
- focus: \`gather_sample_build_internal_only\` reason으로 5m 유지되는 query

## 대상

${table(
  ["query", "family", "observed", "changed", "active", "normal type", "detail done", "detail pending", "pool any"],
  packet.map((row) => [
    row.query,
    row.family,
    num(row.observed),
    `${num(row.changed)} (${pct(row.changed, row.observed)})`,
    num(row.active),
    `${num(row.normalType)} (${pct(row.normalType, row.observed)})`,
    `${num(row.detailsDone)} (${pct(row.detailsDone, row.observed)})`,
    num(row.detailsPending),
    num(row.poolAny),
  ]),
)}

## 해석

${packet.map((row, index) => `${index + 1}. **${row.query}**
   - observed ${num(row.observed)}, changed ${pct(row.changed, row.observed)}, detail done ${pct(row.detailsDone, row.observed)}, normal type ${pct(row.normalType, row.observed)}
   - 아직 \`detailsDone < 40\` 이고 pool signal이 없어, internal_only 고변동 query라도 표본축적 단계로 보는 편이 안전하다.`).join("\n")}

## 판단

1. 이 3개는 비용 관점만 보면 10m로 늦추고 싶어도, 현재는 상세 표본 얕음이 더 큰 이유다.
2. 즉 cadence gate patch를 하더라도 \`gather_sample_build_internal_only\`는 예외로 5m 유지해야 한다.
3. 다음 단계는 이 3개가 왜 상세 표본이 얕은지 search -> detail queue -> normal classification 흐름에서 보는 것이다.
`;

const outPath = path.join(reportDir, "gather-sample-build-packet-latest.md");
const jsonPath = path.join(reportDir, "gather-sample-build-packet-latest.json");

await mkdir(reportDir, { recursive: true });
await writeFile(outPath, markdown);
await writeFile(jsonPath, JSON.stringify(packet, null, 2));

console.log(`wrote ${outPath}`);
