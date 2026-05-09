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
    // ignore
  }
}

await loadEnvFile(path.join(appDir, ".env.local"));
await loadEnvFile(path.join(appDir, ".env"));

const SELLING_FEE_RATE = 0.035;
const RESELL_SHIPPING_FEE = 3500;
const SAFETY_BUFFER = 5000;

function bandFromProfit(profitMin, profitMax) {
  const avg = Math.round((profitMin + profitMax) / 2);
  if (avg >= 70_000) return 3;
  if (avg >= 40_000) return 2;
  if (avg >= 20_000) return 1;
  return null;
}

function supabaseRestUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_URL 필요");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function authHeaders(prefer) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 필요");
  const headers = {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
  if (prefer) headers.prefer = prefer;
  return headers;
}

async function fetchListings(limit, offset) {
  const cols =
    "pid,price,sku_median,shipping_fee,shipping_fee_general,estimated_buy_cost";
  const url = `${supabaseRestUrl()}/mvp_listings?select=${cols}&order=updated_at.desc&limit=${limit}&offset=${offset}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`fetchListings ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function fetchAnalysis(pids) {
  if (pids.length === 0) return new Map();
  const url = `${supabaseRestUrl()}/mvp_listing_analysis?select=pid,score,score_flags&pid=in.(${pids.join(",")})`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`fetchAnalysis ${res.status}: ${await res.text()}`);
  }
  const rows = await res.json();
  return new Map(rows.map((r) => [Number(r.pid), r]));
}

async function fetchParsed(pids) {
  if (pids.length === 0) return new Map();
  const url = `${supabaseRestUrl()}/mvp_listing_parsed?select=pid,comparable_key,parse_confidence&pid=in.(${pids.join(",")})`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`fetchParsed ${res.status}: ${await res.text()}`);
  }
  const rows = await res.json();
  return new Map(rows.map((r) => [Number(r.pid), r]));
}

async function upsertPool(rows) {
  if (rows.length === 0) return;
  const url = `${supabaseRestUrl()}/mvp_candidate_pool?on_conflict=pid`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders("resolution=merge-duplicates"),
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`upsertPool ${res.status}: ${await res.text()}`);
  }
}

function computeConfidence(parseConfidence, scoreFlags) {
  let c = Math.max(0, Math.min(1, Number(parseConfidence ?? 0.5) || 0.5));
  const flags = scoreFlags ?? [];
  if (flags.includes("ai_normal")) c = Math.min(1, c + 0.2);
  if (flags.includes("ai_review_unavailable")) c = Math.max(0, c - 0.1);
  if (flags.some((f) => typeof f === "string" && f.endsWith("_low_confidence"))) c = Math.max(0, c - 0.15);
  return Math.round(c * 100) / 100;
}

async function main() {
  const pageSize = 200;
  let offset = 0;
  let totalUpserted = 0;
  let totalSkipped = 0;
  const now = new Date().toISOString();

  while (true) {
    const listings = await fetchListings(pageSize, offset);
    if (listings.length === 0) break;

    const pids = listings.map((l) => Number(l.pid));
    const [analysisMap, parsedMap] = await Promise.all([
      fetchAnalysis(pids),
      fetchParsed(pids),
    ]);

    const poolRows = [];
    for (const l of listings) {
      const pid = Number(l.pid);
      const skuMedian = Number(l.sku_median) || 0;
      const price = Number(l.price) || 0;
      const shippingFee = Number(l.shipping_fee) || 0;
      const shippingFeeGeneral = l.shipping_fee_general == null ? null : Number(l.shipping_fee_general);
      const estimatedBuyCost = Number(l.estimated_buy_cost) || price;
      if (skuMedian <= 0 || price <= 0) {
        totalSkipped += 1;
        continue;
      }
      const sellFee = Math.round(skuMedian * SELLING_FEE_RATE);
      const buyMin = estimatedBuyCost;
      const buyMax = price + (shippingFeeGeneral ?? shippingFee);
      const profitMax = Math.max(0, skuMedian - buyMin - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
      const profitMin = Math.max(0, skuMedian - buyMax - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
      const band = bandFromProfit(profitMin, profitMax);
      if (band === null) {
        totalSkipped += 1;
        continue;
      }
      const analysis = analysisMap.get(pid);
      const parsed = parsedMap.get(pid);
      poolRows.push({
        pid,
        profit_band: band,
        expected_profit_min: profitMin,
        expected_profit_max: profitMax,
        score: Number(analysis?.score ?? 0),
        confidence: computeConfidence(parsed?.parse_confidence, analysis?.score_flags),
        comparable_key: parsed?.comparable_key ?? null,
        last_verified_at: now,
        updated_at: now,
      });
    }

    await upsertPool(poolRows);
    totalUpserted += poolRows.length;
    console.log(`offset=${offset} listings=${listings.length} upserted=${poolRows.length} (running total ${totalUpserted}, skipped ${totalSkipped})`);

    if (listings.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`done. total_upserted=${totalUpserted} total_skipped=${totalSkipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
