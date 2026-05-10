import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

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

const CATEGORY_STATUS = {
  earphone: "ready",
  smartwatch: "ready",
  smartphone: "internal_only",
  tablet: "internal_only",
  laptop: "internal_only",
  small_appliance: "blocked",
};

function arg(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function intArg(name, fallback, min, max) {
  const parsed = Number.parseInt(arg(name, String(fallback)), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
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
  const res = await fetch(`${supabaseRestUrl()}${pathname}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${await res.text()}`);
  return res.json();
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function inc(map, key, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function rows(map, limit = 20) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function table(headers, bodyRows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...bodyRows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function marketConfidenceRank(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  if (value === "low") return 1;
  return 0;
}

function latestMarketByKey(rows) {
  const map = new Map();
  for (const row of rows) {
    const prev = map.get(row.comparable_key);
    if (!prev || Date.parse(row.computed_at ?? row.date) > Date.parse(prev.computed_at ?? prev.date)) {
      map.set(row.comparable_key, row);
    }
  }
  return map;
}

function recommendation(summary) {
  if (summary.total < 100) return "keep_internal: 표본 100건 미만";
  if (summary.parseReadyRate < 75) return "keep_internal: 옵션 파서 통과율 75% 미만";
  if (summary.criticalUnknownRate > 20) return "keep_internal: 치명 옵션 누락 20% 초과";
  if (summary.trustedMarketKeyCount < 5) return "keep_internal: medium/high 시세 key 5개 미만";
  if (summary.highRiskExamples.length > 0) return "keep_internal: 고위험 샘플 검수 필요";
  return "ready_candidate: 운영자 검수 후 ready 승격 가능";
}

const categories = arg("category", "smartphone,laptop")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const limit = intArg("limit", 2000, 100, 10000);

const rawRows = await fetchJson(
  `/mvp_raw_listings?select=pid,name,price,sku_id,sku_name,thumbnail_url,listing_state,detail_status,listing_type,sale_status,last_seen_at&detail_status=eq.done&listing_type=eq.normal&sku_id=not.is.null&order=last_seen_at.desc&limit=${limit}`,
);
const pids = rawRows.map((row) => Number(row.pid)).filter(Number.isFinite);
const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));

const parsedRows = [];
for (const chunk of chunkArray(pids, 200)) {
  parsedRows.push(...await fetchJson(
    `/mvp_listing_parsed?select=pid,category,family,model,variant_key,comparable_key,parse_confidence,needs_review,parsed_json&pid=in.(${chunk.join(",")})`,
  ));
}

const keys = [...new Set(parsedRows.map((row) => row.comparable_key).filter(Boolean))];
const marketRows = [];
for (const chunk of chunkArray(keys, 50)) {
  const encoded = chunk.map(encodeURIComponent).join(",");
  marketRows.push(...await fetchJson(
    `/mvp_market_price_daily?select=date,comparable_key,confidence,active_sample_count,sold_sample_count,disappeared_sample_count,blended_median_price,computed_at&comparable_key=in.(${encoded})&order=date.desc,computed_at.desc&limit=${Math.max(1000, chunk.length * 5)}`,
  ));
}
const marketByKey = latestMarketByKey(marketRows);

const summaries = [];
for (const category of categories) {
  const categoryParsed = parsedRows.filter((row) => row.category === category);
  const total = categoryParsed.length;
  const parseReady = categoryParsed.filter((row) => (
    row.comparable_key &&
    !row.needs_review &&
    Number(row.parse_confidence ?? 0) >= 0.65
  ));
  const criticalUnknowns = new Map();
  const unknownParts = new Map();
  const keyCounts = new Map();
  const trustedKeys = new Set();
  const highKeys = new Set();
  const mediumKeys = new Set();
  const lowKeys = new Set();
  const highRiskExamples = [];
  const examples = {
    needsReview: [],
    lowConfidence: [],
    trusted: [],
  };

  for (const row of categoryParsed) {
    const raw = rawByPid.get(Number(row.pid));
    const json = row.parsed_json ?? {};
    for (const item of json.critical_unknown ?? []) inc(criticalUnknowns, String(item));
    for (const item of json.unknown_parts ?? []) inc(unknownParts, String(item));
    if (row.comparable_key) inc(keyCounts, row.comparable_key);

    const market = row.comparable_key ? marketByKey.get(row.comparable_key) : null;
    if (market?.confidence === "high") highKeys.add(row.comparable_key);
    if (market?.confidence === "medium") mediumKeys.add(row.comparable_key);
    if (market?.confidence === "low") lowKeys.add(row.comparable_key);
    if (marketConfidenceRank(market?.confidence) >= 2) trustedKeys.add(row.comparable_key);

    const sample = {
      pid: row.pid,
      name: raw?.name ?? "",
      price: raw?.price ?? 0,
      sku: raw?.sku_name ?? "",
      key: row.comparable_key ?? "-",
      confidence: row.parse_confidence ?? 0,
      market: market?.confidence ?? "-",
      median: market?.blended_median_price ?? null,
      unknown: (json.critical_unknown ?? []).join(", "),
    };
    if (row.needs_review && examples.needsReview.length < 5) examples.needsReview.push(sample);
    if (Number(row.parse_confidence ?? 0) < 0.65 && examples.lowConfidence.length < 5) examples.lowConfidence.push(sample);
    if (!row.needs_review && marketConfidenceRank(market?.confidence) >= 2 && examples.trusted.length < 5) examples.trusted.push(sample);

    const rawText = `${raw?.name ?? ""} ${row.comparable_key ?? ""}`.toLowerCase();
    if (
      category === "laptop" &&
      /m1|m2|m3|m4/.test(rawText) &&
      row.comparable_key &&
      !/m[1-4]/.test(row.comparable_key) &&
      highRiskExamples.length < 5
    ) {
      highRiskExamples.push({ ...sample, issue: "apple_silicon_not_in_key" });
    }
  }

  const criticalCount = rows(criticalUnknowns, 100).reduce((sum, row) => sum + row.count, 0);
  const summary = {
    category,
    status: CATEGORY_STATUS[category] ?? "unconfigured",
    total,
    parseReady: parseReady.length,
    parseReadyRate: pct(parseReady.length, total),
    needsReview: categoryParsed.filter((row) => row.needs_review).length,
    lowConfidence: categoryParsed.filter((row) => Number(row.parse_confidence ?? 0) < 0.65).length,
    criticalUnknownCount: criticalCount,
    criticalUnknownRate: pct(criticalCount, total),
    comparableKeyCount: keyCounts.size,
    trustedMarketKeyCount: trustedKeys.size,
    highMarketKeyCount: highKeys.size,
    mediumMarketKeyCount: mediumKeys.size,
    lowMarketKeyCount: lowKeys.size,
    topKeys: rows(keyCounts, 10),
    topCriticalUnknowns: rows(criticalUnknowns, 10),
    topUnknownParts: rows(unknownParts, 10),
    highRiskExamples,
    examples,
  };
  summary.recommendation = recommendation(summary);
  summaries.push(summary);
}

const outDir = path.join(appDir, "category-intelligence", "readiness");
await mkdir(outDir, { recursive: true });
const generatedAt = new Date().toISOString();
const jsonPath = path.join(outDir, "latest.json");
await writeFile(jsonPath, JSON.stringify({ generated_at: generatedAt, limit, categories, summaries }, null, 2));

const md = [
  "# Category Readiness Report",
  "",
  `- generated_at: ${generatedAt}`,
  `- source rows limit: ${limit}`,
  "",
  table(
    ["category", "gate", "rows", "parse ready", "critical unknown", "market trusted keys", "recommendation"],
    summaries.map((item) => [
      item.category,
      item.status,
      String(item.total),
      `${item.parseReady}/${item.total} (${item.parseReadyRate}%)`,
      `${item.criticalUnknownCount} (${item.criticalUnknownRate}%)`,
      `${item.trustedMarketKeyCount} (high ${item.highMarketKeyCount}, medium ${item.mediumMarketKeyCount})`,
      item.recommendation,
    ]),
  ),
  "",
  ...summaries.flatMap((item) => [
    `## ${item.category}`,
    "",
    "### Top Comparable Keys",
    table(["key", "count"], item.topKeys.map((row) => [row.key, String(row.count)])),
    "",
    "### Critical Unknowns",
    item.topCriticalUnknowns.length
      ? table(["unknown", "count"], item.topCriticalUnknowns.map((row) => [row.key, String(row.count)]))
      : "No critical unknowns.",
    "",
    "### Needs Review Examples",
    item.examples.needsReview.length
      ? table(["pid", "name", "sku", "price", "key", "conf", "market", "unknown"], item.examples.needsReview.map((row) => [
          String(row.pid),
          String(row.name).replace(/\|/g, "/"),
          String(row.sku).replace(/\|/g, "/"),
          Number(row.price).toLocaleString("ko-KR"),
          row.key,
          String(row.confidence),
          row.market,
          row.unknown || "-",
        ]))
      : "No needs-review examples.",
    "",
    "### Trusted Examples",
    item.examples.trusted.length
      ? table(["pid", "name", "sku", "price", "key", "conf", "market", "median"], item.examples.trusted.map((row) => [
          String(row.pid),
          String(row.name).replace(/\|/g, "/"),
          String(row.sku).replace(/\|/g, "/"),
          Number(row.price).toLocaleString("ko-KR"),
          row.key,
          String(row.confidence),
          row.market,
          row.median == null ? "-" : Number(row.median).toLocaleString("ko-KR"),
        ]))
      : "No trusted examples yet.",
    "",
    "### High Risk Parser Examples",
    item.highRiskExamples.length
      ? table(["pid", "issue", "name", "key"], item.highRiskExamples.map((row) => [
          String(row.pid),
          row.issue,
          String(row.name).replace(/\|/g, "/"),
          row.key,
        ]))
      : "No high-risk parser examples found in this sample.",
    "",
  ]),
].join("\n");
const mdPath = path.join(outDir, "REPORT.md");
await writeFile(mdPath, md);

console.log(`report saved → ${mdPath}`);
console.table(summaries.map((item) => ({
  category: item.category,
  gate: item.status,
  rows: item.total,
  parseReady: `${item.parseReadyRate}%`,
  criticalUnknown: `${item.criticalUnknownRate}%`,
  trustedKeys: item.trustedMarketKeyCount,
  recommendation: item.recommendation,
})));
