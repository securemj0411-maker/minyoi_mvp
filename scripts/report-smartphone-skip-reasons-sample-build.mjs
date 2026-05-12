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

function classifySkip(detailError) {
  const error = String(detailError ?? "");
  if (!error) return "unknown";
  if (error.includes("title_triage")) return "title_triage";
  if (error.includes("title-only")) return "title_only";
  if (error.includes("buying")) return "buying";
  if (error.includes("accessory")) return "accessory";
  if (error.includes("parts")) return "parts";
  if (error.includes("damaged")) return "damaged";
  if (error.includes("manual_review")) return "manual_review";
  return "other";
}

const focusQueries = ["아이폰 16 프로", "아이폰 14 프로", "아이폰 15 프로"];
const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const allRows = [];
for (const query of focusQueries) {
  const rows = await fetchJson(
    `/mvp_raw_listings?select=pid,query,name,detail_status,listing_type,detail_error,last_seen_at&query=eq.${encodeURIComponent(query)}&detail_status=eq.skipped&last_seen_at=gte.${encodeURIComponent(cutoffIso)}&order=last_seen_at.desc&limit=1000`,
  );
  for (const row of rows) {
    allRows.push({ ...row, skipClass: classifySkip(row.detail_error) });
  }
}

const byQuery = new Map();
for (const row of allRows) {
  const key = String(row.query);
  const current = byQuery.get(key) ?? { query: key, total: 0, byClass: new Map(), samples: [] };
  current.total += 1;
  current.byClass.set(row.skipClass, (current.byClass.get(row.skipClass) ?? 0) + 1);
  if (current.samples.length < 8) {
    current.samples.push({
      name: row.name,
      listingType: row.listing_type,
      detailError: String(row.detail_error ?? "").slice(0, 120),
      skipClass: row.skipClass,
    });
  }
  byQuery.set(key, current);
}

const querySummaries = [...byQuery.values()].map((row) => ({
  query: row.query,
  total: row.total,
  titleTriage: row.byClass.get("title_triage") ?? 0,
  titleOnly: row.byClass.get("title_only") ?? 0,
  accessory: row.byClass.get("accessory") ?? 0,
  parts: row.byClass.get("parts") ?? 0,
  buying: row.byClass.get("buying") ?? 0,
  damaged: row.byClass.get("damaged") ?? 0,
  manualReview: row.byClass.get("manual_review") ?? 0,
  other: row.byClass.get("other") ?? 0,
  unknown: row.byClass.get("unknown") ?? 0,
  samples: row.samples,
}));

const markdown = `# Smartphone Sample-Build Skip Reasons

- generated_at: ${new Date().toISOString()}
- window: 최근 24시간
- mode: read-only / no runtime change
- focus: \`아이폰 16 프로\`, \`아이폰 14 프로\`, \`아이폰 15 프로\` 의 skipped 이유 분해

## 요약

${table(
  ["query", "skipped total", "title triage", "title only", "accessory", "parts", "buying", "damaged", "manual review", "other/unknown"],
  querySummaries.map((row) => [
    row.query,
    num(row.total),
    `${num(row.titleTriage)} (${pct(row.titleTriage, row.total)})`,
    `${num(row.titleOnly)} (${pct(row.titleOnly, row.total)})`,
    `${num(row.accessory)} (${pct(row.accessory, row.total)})`,
    `${num(row.parts)} (${pct(row.parts, row.total)})`,
    `${num(row.buying)} (${pct(row.buying, row.total)})`,
    `${num(row.damaged)} (${pct(row.damaged, row.total)})`,
    `${num(row.manualReview)} (${pct(row.manualReview, row.total)})`,
    `${num(row.other + row.unknown)} (${pct(row.other + row.unknown, row.total)})`,
  ]),
)}

## 샘플

${querySummaries.map((row) => `### ${row.query}

${table(
  ["skip class", "listing type", "name", "detail error"],
  row.samples.map((sample) => [sample.skipClass, sample.listingType, sample.name, sample.detailError]),
)}`).join("\n\n")}

## 판단

1. 이 리포트는 smartphone broad query가 왜 sample-build 상태인지 skip reason 기준으로 본다.
2. accessory/title-triage가 본체면 cadence보다 query semantics/triage 품질 문제가 더 크다.
3. other/unknown 비율이 크면 skip reason taxonomy 자체를 먼저 정리해야 한다.
`;

const outPath = path.join(reportDir, "smartphone-skip-reasons-sample-build-latest.md");
const jsonPath = path.join(reportDir, "smartphone-skip-reasons-sample-build-latest.json");

await mkdir(reportDir, { recursive: true });
await writeFile(outPath, markdown);
await writeFile(jsonPath, JSON.stringify(querySummaries, null, 2));

console.log(`wrote ${outPath}`);
