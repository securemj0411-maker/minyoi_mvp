import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  bandFromProfit,
  computePoolConfidence,
  poolSkipReason,
} from "../src/lib/pool-policy.mjs";

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
    // ignore
  }
}

await loadEnvFile(path.join(appDir, ".env.local"));
await loadEnvFile(path.join(appDir, ".env"));

const RESELL_SHIPPING_FEE = 3500;
const SAFETY_BUFFER = 5000;
const SELLING_FEE_RATE = 0.035;

function supabaseRestUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_URL 필요");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function authHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 필요");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
  };
}

async function fetchJson(pathname) {
  const res = await fetch(`${supabaseRestUrl()}${pathname}`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`${pathname} ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function addCount(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function toRows(map) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }));
}

const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = Math.max(100, Math.min(5000, Number(limitArg?.split("=")[1] ?? 1000) || 1000));

const pool = await fetchJson(
  "/mvp_candidate_pool?select=pid,profit_band,status,expected_profit_min,expected_profit_max,confidence,comparable_key,exposure_count,max_exposure,last_verified_at&order=expected_profit_min.desc&limit=5000",
);
const poolByBandStatus = new Map();
for (const row of pool) addCount(poolByBandStatus, `band${row.profit_band}:${row.status}`);

console.log(`\nPOOL total=${pool.length}`);
console.table(toRows(poolByBandStatus));
console.table(pool.slice(0, 20).map((row) => ({
  pid: row.pid,
  band: row.profit_band,
  status: row.status,
  profitMin: row.expected_profit_min,
  profitMax: row.expected_profit_max,
  confidence: row.confidence,
  exposure: `${row.exposure_count}/${row.max_exposure}`,
  key: row.comparable_key,
})));

const rawRows = await fetchJson(
  `/mvp_raw_listings?select=pid,name,price,sku_name,thumbnail_url,sku_id,last_seen_at&detail_status=eq.done&listing_type=eq.normal&sku_id=not.is.null&order=last_seen_at.desc&limit=${limit}`,
);
const pids = rawRows.map((row) => Number(row.pid));
const chunks = [];
for (let i = 0; i < pids.length; i += 200) chunks.push(pids.slice(i, i + 200));

const analysisMap = new Map();
const parsedMap = new Map();
const listingMap = new Map();
for (const chunk of chunks) {
  const ids = chunk.join(",");
  const analyses = await fetchJson(`/mvp_listing_analysis?select=pid,score,risk_hits,score_flags&pid=in.(${ids})`);
  const parsedRows = await fetchJson(`/mvp_listing_parsed?select=pid,comparable_key,parse_confidence,needs_review&pid=in.(${ids})`);
  const listings = await fetchJson(`/mvp_listings?select=pid,price,sku_median,shipping_fee,shipping_fee_general,estimated_buy_cost,thumbnail_url,name,sku_name&pid=in.(${ids})`);
  for (const row of analyses) analysisMap.set(Number(row.pid), row);
  for (const row of parsedRows) parsedMap.set(Number(row.pid), row);
  for (const row of listings) listingMap.set(Number(row.pid), row);
}

const reasons = new Map();
const examples = new Map();
let simulatedPass = 0;

function reject(reason, row) {
  addCount(reasons, reason);
  if (!examples.has(reason)) examples.set(reason, row);
}

for (const raw of rawRows) {
  const pid = Number(raw.pid);
  const listing = listingMap.get(pid);
  if (!listing) {
    reject("not_scored_yet", raw);
    continue;
  }
  const skuMedian = Number(listing.sku_median) || 0;
  const price = Number(listing.price ?? raw.price) || 0;
  const shippingFee = Number(listing.shipping_fee) || 0;
  const shippingFeeGeneral = listing.shipping_fee_general == null ? null : Number(listing.shipping_fee_general);
  const estimatedBuyCost = Number(listing.estimated_buy_cost) || price;
  const analysis = analysisMap.get(pid);
  const parsed = parsedMap.get(pid);
  const scoreFlags = analysis?.score_flags ?? [];

  if (skuMedian <= 0 || price <= 0) {
    reject("no_price_or_median", listing);
    continue;
  }

  const sellFee = Math.round(skuMedian * SELLING_FEE_RATE);
  const profitMax = Math.max(0, skuMedian - estimatedBuyCost - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
  const profitMin = Math.max(0, skuMedian - (price + (shippingFeeGeneral ?? shippingFee)) - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
  const band = bandFromProfit(profitMin, profitMax);
  const confidence = computePoolConfidence(parsed?.parse_confidence, scoreFlags);

  const diagnostic = { ...raw, ...listing, profitMin, profitMax, scoreFlags, confidence, parsed };
  const skipReason = poolSkipReason({
    profitMin,
    price,
    skuMedian,
    riskHits: Number(analysis?.risk_hits ?? 0),
    thumbnailUrl: listing.thumbnail_url,
    categoryCanEnterPool: true,
    comparableKey: parsed?.comparable_key,
    needsReview: Boolean(parsed?.needs_review),
    confidence,
    scoreFlags,
  });
  if (band === null) reject("profit_below_band", diagnostic);
  else if (skipReason) reject(skipReason, diagnostic);
  else simulatedPass += 1;
}

console.log(`\nSIMULATED pass=${simulatedPass} / listings=${rawRows.length}`);
console.table(toRows(reasons));
console.log("\nEXAMPLES");
for (const [reason, row] of examples.entries()) {
  console.log(`[${reason}]`, {
    pid: row.pid,
    name: row.name,
    sku: row.sku_name,
    price: row.price,
    median: row.sku_median,
    profitMin: row.profitMin,
    profitMax: row.profitMax,
    flags: row.scoreFlags,
    confidence: row.confidence,
    parsed: row.parsed,
  });
}
