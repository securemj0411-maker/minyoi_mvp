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

function countBy(rows, key) {
  const out = new Map();
  for (const row of rows) {
    const value = String(row?.[key] ?? "null");
    out.set(value, (out.get(value) ?? 0) + 1);
  }
  return out;
}

const sourcePath = path.join(reportDir, "gather-sample-build-packet-latest.json");
const source = JSON.parse(await readFile(sourcePath, "utf-8"));
const queries = source.map((row) => String(row.query));
const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const rowsByQuery = new Map();
for (const query of queries) {
  const rows = await fetchJson(
    `/mvp_raw_listings?select=pid,query,detail_status,listing_type,last_seen_at,last_changed_at,detail_error&query=eq.${encodeURIComponent(query)}&last_seen_at=gte.${encodeURIComponent(cutoffIso)}&order=last_seen_at.desc&limit=1000`,
  );
  rowsByQuery.set(query, rows);
}

const allPids = [...rowsByQuery.values()].flat().map((row) => Number(row.pid)).filter(Number.isFinite);
const queueRows = allPids.length
  ? await fetchJson(`/mvp_detail_queue?select=pid,status,attempts,max_attempts,last_error,updated_at&pid=in.(${allPids.join(",")})&limit=1000`)
  : [];
const queueByPid = new Map(queueRows.map((row) => [Number(row.pid), row]));

const summaryRows = queries.map((query) => {
  const rows = rowsByQuery.get(query) ?? [];
  const detailCounts = countBy(rows, "detail_status");
  const typeCounts = countBy(rows, "listing_type");
  const pids = rows.map((row) => Number(row.pid)).filter(Number.isFinite);
  const queueHits = pids.map((pid) => queueByPid.get(pid)).filter(Boolean);
  const queueCounts = countBy(queueHits, "status");
  const failedQueue = queueHits.filter((row) => row.status === "failed");
  return {
    query,
    observed: rows.length,
    detailPending: detailCounts.get("pending") ?? 0,
    detailDone: detailCounts.get("done") ?? 0,
    detailFailed: detailCounts.get("failed") ?? 0,
    detailSkipped: detailCounts.get("skipped") ?? 0,
    normalType: typeCounts.get("normal") ?? 0,
    partsType: typeCounts.get("parts") ?? 0,
    accessoryType: typeCounts.get("accessory") ?? 0,
    queuePresent: queueHits.length,
    queuePending: queueCounts.get("pending") ?? 0,
    queueProcessing: queueCounts.get("processing") ?? 0,
    queueDone: queueCounts.get("done") ?? 0,
    queueFailed: queueCounts.get("failed") ?? 0,
    failedQueueExamples: failedQueue.slice(0, 3).map((row) => `${row.attempts}/${row.max_attempts}:${String(row.last_error ?? "").slice(0, 80)}`),
  };
});

const markdown = `# Gather Sample Build Flow Diagnosis

- generated_at: ${new Date().toISOString()}
- window: 최근 24시간
- mode: read-only / no runtime change
- focus: \`gather_sample_build_internal_only\` 3개 query의 search -> detail queue -> raw detail status 흐름

## 요약표

${table(
  ["query", "observed", "detail pending", "detail done", "detail failed", "detail skipped", "normal", "parts", "accessory", "queue present", "queue pending", "queue done", "queue failed"],
  summaryRows.map((row) => [
    row.query,
    num(row.observed),
    `${num(row.detailPending)} (${pct(row.detailPending, row.observed)})`,
    `${num(row.detailDone)} (${pct(row.detailDone, row.observed)})`,
    `${num(row.detailFailed)} (${pct(row.detailFailed, row.observed)})`,
    `${num(row.detailSkipped)} (${pct(row.detailSkipped, row.observed)})`,
    `${num(row.normalType)} (${pct(row.normalType, row.observed)})`,
    `${num(row.partsType)} (${pct(row.partsType, row.observed)})`,
    `${num(row.accessoryType)} (${pct(row.accessoryType, row.observed)})`,
    num(row.queuePresent),
    num(row.queuePending),
    num(row.queueDone),
    num(row.queueFailed),
  ]),
)}

## Queue failed examples

${summaryRows.map((row) => `### ${row.query}

${row.failedQueueExamples.length > 0 ? row.failedQueueExamples.map((item) => `- ${item}`).join("\n") : "- failed queue example 없음"}`).join("\n\n")}

## 판단

1. 이 리포트는 raw의 \`detail_status\`와 \`mvp_detail_queue\` 현재 상태를 같이 본다.
2. 만약 queue present 대비 done이 낮고 failed가 많으면 detail worker 병목 가능성이 크다.
3. 반대로 queue 자체가 거의 없으면 search 단계에서 detail queue 진입 조건이 엄격한지 먼저 봐야 한다.
4. cadence patch 전에, 이 3개가 sample-build로 남는 이유가 queue 진입 부족인지 worker 처리 부족인지 먼저 구분해야 한다.
`;

const outPath = path.join(reportDir, "gather-sample-build-flow-diagnosis-latest.md");
const jsonPath = path.join(reportDir, "gather-sample-build-flow-diagnosis-latest.json");

await mkdir(reportDir, { recursive: true });
await writeFile(outPath, markdown);
await writeFile(jsonPath, JSON.stringify(summaryRows, null, 2));

console.log(`wrote ${outPath}`);
