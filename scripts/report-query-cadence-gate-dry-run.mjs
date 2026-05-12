import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportDir = path.join(appDir, "reports");

async function loadEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional env file
  }
}

await loadEnvFile(path.join(appDir, ".env.local"));
await loadEnvFile(path.join(appDir, ".env"));

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

function supabaseRestUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_URL 필요");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function authHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 필요");
  return { apikey: key, authorization: `Bearer ${key}` };
}

async function fetchJson(pathname) {
  const res = await fetch(`${supabaseRestUrl()}${pathname}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`${pathname} ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

const sourcePath = path.join(reportDir, "query-cadence-simulator-latest.json");
const source = JSON.parse(await readFile(sourcePath, "utf-8"));
const baseline = source?.scenarios?.baseline;
const relaxed = source?.scenarios?.relaxedGather;
if (!baseline || !relaxed) {
  throw new Error("query-cadence-simulator-latest.json에 baseline/relaxedGather가 없습니다.");
}

const registryRows = await fetchJson("/mvp_search_queries?select=query,cadence_minutes,mode,reason,last_scanned_at,enabled&limit=500");
const registryByQuery = new Map(registryRows.map((row) => [String(row.query), row]));
const baselineByQuery = new Map(baseline.queryRows.map((row) => [String(row.query), row]));

const changed = [];
const unchanged = [];

for (const row of relaxed.queryRows) {
  const query = String(row.query);
  const registry = registryByQuery.get(query);
  const currentCadence = Number(registry?.cadence_minutes ?? 5);
  const currentMode = String(registry?.mode ?? baselineByQuery.get(query)?.mode ?? "unknown");
  const proposedCadence = row.cadence === "5m" ? 5 : row.cadence === "10m" ? 10 : row.cadence === "30m" ? 30 : 60;
  const currentReason = String(registry?.reason ?? baselineByQuery.get(query)?.reason ?? "");
  const delta = {
    query,
    family: row.family,
    readiness: row.readinessStatus,
    currentCadence,
    proposedCadence,
    currentMode,
    proposedMode: row.mode,
    currentReason,
    proposedReason: row.reason,
    observed: row.observed,
    changed: row.changed,
    detailsDone: row.detailsDone,
    poolAny: row.poolAny,
  };
  if (currentCadence !== proposedCadence || currentMode !== row.mode || currentReason !== row.reason) {
    changed.push(delta);
  } else {
    unchanged.push(delta);
  }
}

changed.sort((a, b) => a.proposedCadence - b.proposedCadence || b.observed - a.observed);
unchanged.sort((a, b) => b.observed - a.observed);

const slowed = changed.filter((row) => row.proposedCadence > row.currentCadence);
const spedUp = changed.filter((row) => row.proposedCadence < row.currentCadence);

const summary = {
  generatedAt: new Date().toISOString(),
  sourceGeneratedAt: source.generatedAt,
  windowHours: source.windowHours,
  registryRows: registryRows.length,
  evaluatedQueries: relaxed.queryRows.length,
  changedCount: changed.length,
  unchangedCount: unchanged.length,
  slowedCount: slowed.length,
  spedUpCount: spedUp.length,
  changed,
  unchangedTop: unchanged.slice(0, 15),
};

const markdown = `# Query Cadence Gate Dry Run

- generated_at: ${summary.generatedAt}
- source_generated_at: ${summary.sourceGeneratedAt}
- window: 최근 ${summary.windowHours}시간
- mode: read-only / no runtime change
- source:
  - \`query-cadence-simulator-latest.json\`
  - \`mvp_search_queries\` 현재 registry 상태

## 요약

- registry rows fetched: ${num(summary.registryRows)}
- evaluated queries: ${num(summary.evaluatedQueries)}
- proposed changes: ${num(summary.changedCount)} (${pct(summary.changedCount, summary.evaluatedQueries)})
- unchanged: ${num(summary.unchangedCount)}
- cadence slower: ${num(summary.slowedCount)}
- cadence faster: ${num(summary.spedUpCount)}

## 변경 필요 상위군

${table(
  ["query", "family", "readiness", "current", "proposed", "current reason", "proposed reason", "observed", "changed", "detail done", "pool any"],
  changed.slice(0, 25).map((row) => [
    row.query,
    row.family,
    row.readiness,
    `${row.currentMode} ${row.currentCadence}m`,
    `${row.proposedMode} ${row.proposedCadence}m`,
    row.currentReason,
    row.proposedReason,
    num(row.observed),
    `${num(row.changed)} (${pct(row.changed, row.observed)})`,
    num(row.detailsDone),
    num(row.poolAny),
  ]),
)}

## 이미 맞는 상위군

${table(
  ["query", "family", "cadence", "reason", "observed", "changed", "detail done", "pool any"],
  unchanged.slice(0, 15).map((row) => [
    row.query,
    row.family,
    `${row.currentMode} ${row.currentCadence}m`,
    row.proposedReason,
    num(row.observed),
    `${num(row.changed)} (${pct(row.changed, row.observed)})`,
    num(row.detailsDone),
    num(row.poolAny),
  ]),
)}

## 판단

1. 이 dry-run은 registry 실제 값을 읽지만 쓰지 않는다.
2. 다음 runtime gate는 대부분 “속도 업”이 아니라 gather query 일부를 10m로 늦추는 쪽일 가능성이 높다.
3. ready category cadence는 거의 그대로 유지해야 한다.
4. 실제 적용 전에는 \`gather_sample_build_internal_only\` 3개를 계속 5m에 두는 이유가 유지되는지 한 번 더 보는 게 맞다.
`;

const outPath = path.join(reportDir, "query-cadence-gate-dry-run-latest.md");
const jsonPath = path.join(reportDir, "query-cadence-gate-dry-run-latest.json");

await mkdir(reportDir, { recursive: true });
await writeFile(outPath, markdown);
await writeFile(jsonPath, JSON.stringify(summary, null, 2));

console.log(`wrote ${outPath}`);
