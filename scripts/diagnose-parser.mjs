import { readFile } from "node:fs/promises";
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

function inc(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function rows(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count }));
}

const limit = intArg("limit", 1000, 100, 5000);
const rawRows = await fetchJson(
  `/mvp_raw_listings?select=pid,name,sku_name,price&detail_status=eq.done&listing_type=eq.normal&sku_id=not.is.null&order=last_seen_at.desc&limit=${limit}`,
);
const targetPids = rawRows.map((row) => Number(row.pid)).filter(Number.isFinite);
const targetChunks = [];
for (let i = 0; i < targetPids.length; i += 200) targetChunks.push(targetPids.slice(i, i + 200));

const parsed = [];
for (const chunk of targetChunks) {
  parsed.push(...await fetchJson(
    `/mvp_listing_parsed?select=pid,parser_version,category,family,model,comparable_key,parse_confidence,needs_review,parsed_json&pid=in.(${chunk.join(",")})`,
  ));
}
const pids = parsed.map((row) => Number(row.pid)).filter(Number.isFinite);
const chunks = [];
for (let i = 0; i < pids.length; i += 200) chunks.push(pids.slice(i, i + 200));

const listingMap = new Map(rawRows.map((row) => [Number(row.pid), row]));
for (const chunk of chunks) {
  const rows = await fetchJson(`/mvp_raw_listings?select=pid,name,sku_name,price&pid=in.(${chunk.join(",")})`);
  for (const row of rows) listingMap.set(Number(row.pid), row);
}

const totals = {
  total: rawRows.length,
  parsed: parsed.length,
  missingParsed: rawRows.length - parsed.length,
  needsReview: 0,
  noComparableKey: 0,
  lowConfidence: 0,
};
const byCategory = new Map();
const unknownParts = new Map();
const criticalUnknown = new Map();
const parserVersion = new Map();
const examples = new Map();

for (const row of parsed) {
  const json = row.parsed_json ?? {};
  const category = row.category ?? json.category ?? "unknown";
  inc(byCategory, category);
  inc(parserVersion, row.parser_version ?? json.parser_version ?? "unknown");
  if (row.needs_review) totals.needsReview += 1;
  if (!row.comparable_key) totals.noComparableKey += 1;
  if (Number(row.parse_confidence ?? 0) < 0.65) totals.lowConfidence += 1;

  for (const item of json.unknown_parts ?? []) {
    const key = String(item);
    inc(unknownParts, key);
    if (!examples.has(key)) examples.set(key, { ...listingMap.get(Number(row.pid)), parsed: row });
  }
  for (const item of json.critical_unknown ?? []) {
    const key = String(item);
    inc(criticalUnknown, key);
    if (!examples.has(`critical:${key}`)) examples.set(`critical:${key}`, { ...listingMap.get(Number(row.pid)), parsed: row });
  }
}

console.log("\nPARSER SUMMARY");
console.table([totals]);
console.log("\nBY CATEGORY");
console.table(rows(byCategory));
console.log("\nUNKNOWN PARTS");
console.table(rows(unknownParts));
console.log("\nCRITICAL UNKNOWN");
console.table(rows(criticalUnknown));
console.log("\nPARSER VERSION");
console.table(rows(parserVersion));
console.log("\nEXAMPLES");
for (const [reason, sample] of [...examples.entries()].slice(0, 12)) {
  console.log(`[${reason}]`, {
    pid: sample.pid,
    name: sample.name,
    sku: sample.sku_name,
    price: sample.price,
    key: sample.parsed?.comparable_key,
    confidence: sample.parsed?.parse_confidence,
    needsReview: sample.parsed?.needs_review,
    parsedJson: sample.parsed?.parsed_json,
  });
}
