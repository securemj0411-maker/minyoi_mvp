import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  bandFromProfit,
  computePoolConfidence,
  poolMaxExposure,
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

const SELLING_FEE_RATE = 0.035;
const RESELL_SHIPPING_FEE = 3500;
const SAFETY_BUFFER = 5000;

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
    "pid,price,sku_median,shipping_fee,shipping_fee_general,estimated_buy_cost,thumbnail_url";
  const url = `${supabaseRestUrl()}/mvp_listings?select=${cols}&order=updated_at.desc&limit=${limit}&offset=${offset}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`fetchListings ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function fetchAnalysis(pids) {
  if (pids.length === 0) return new Map();
  const url = `${supabaseRestUrl()}/mvp_listing_analysis?select=pid,score,risk_hits,score_flags&pid=in.(${pids.join(",")})`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`fetchAnalysis ${res.status}: ${await res.text()}`);
  }
  const rows = await res.json();
  return new Map(rows.map((r) => [Number(r.pid), r]));
}

async function fetchParsed(pids) {
  if (pids.length === 0) return new Map();
  const url = `${supabaseRestUrl()}/mvp_listing_parsed?select=pid,category,comparable_key,parse_confidence,needs_review&pid=in.(${pids.join(",")})`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`fetchParsed ${res.status}: ${await res.text()}`);
  }
  const rows = await res.json();
  return new Map(rows.map((r) => [Number(r.pid), r]));
}

async function fetchActivePool() {
  const url = `${supabaseRestUrl()}/mvp_candidate_pool?select=pid,status&status=in.(ready,reserved)&limit=5000`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`fetchActivePool ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function fetchRawListingTypes(pids) {
  if (pids.length === 0) return new Map();
  const rows = [];
  for (let i = 0; i < pids.length; i += 200) {
    const chunk = pids.slice(i, i + 200);
    const url = `${supabaseRestUrl()}/mvp_raw_listings?select=pid,listing_type&pid=in.(${chunk.join(",")})`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      throw new Error(`fetchRawListingTypes ${res.status}: ${await res.text()}`);
    }
    rows.push(...await res.json());
  }
  return new Map(rows.map((r) => [Number(r.pid), r]));
}

async function fetchCategoryReadiness() {
  const url = `${supabaseRestUrl()}/mvp_category_readiness?select=category,status`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`fetchCategoryReadiness ${res.status}: ${await res.text()}`);
  }
  return new Map((await res.json()).map((row) => [row.category, row.status]));
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

async function invalidatePoolRows(entries) {
  if (entries.length === 0) return;
  await Promise.all(entries.map(async (entry) => {
    const url = `${supabaseRestUrl()}/mvp_candidate_pool?pid=eq.${entry.pid}&status=in.(ready,reserved)`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: authHeaders("return=minimal"),
      body: JSON.stringify({
        status: "invalidated",
        invalidated_reason: entry.reason.slice(0, 120),
        reserved_until: null,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      throw new Error(`invalidatePoolRows ${res.status}: ${await res.text()}`);
    }
  }));
}

function categoryCanEnterPool(readinessMap, category) {
  return readinessMap.get(category) === "ready";
}

async function cleanupStaleActivePool(readinessMap) {
  const active = await fetchActivePool();
  const pids = active.map((row) => Number(row.pid)).filter(Number.isFinite);
  if (pids.length === 0) return 0;

  const [rawMap, parsedMap] = await Promise.all([
    fetchRawListingTypes(pids),
    fetchParsed(pids),
  ]);

  const invalidations = [];
  for (const row of active) {
    const pid = Number(row.pid);
    const raw = rawMap.get(pid);
    const parsed = parsedMap.get(pid);
    const reason =
      raw?.listing_type !== "normal" ? `raw_${raw?.listing_type ?? "missing"}` :
      !parsed?.comparable_key ? "missing_comparable_key" :
      parsed?.needs_review ? "option_needs_review" :
      !categoryCanEnterPool(readinessMap, parsed?.category) ? `category_${parsed?.category ?? "missing"}_not_ready` :
      null;
    if (reason) invalidations.push({ pid, reason });
  }

  await invalidatePoolRows(invalidations);
  return invalidations.length;
}

async function main() {
  const pageSize = 200;
  let offset = 0;
  let totalUpserted = 0;
  let totalSkipped = 0;
  const now = new Date().toISOString();
  const readinessMap = await fetchCategoryReadiness();
  const cleaned = await cleanupStaleActivePool(readinessMap);
  console.log(`cleanup stale active pool invalidated=${cleaned}`);

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
      const scoreFlags = analysis?.score_flags ?? [];
      const confidence = computePoolConfidence(parsed?.parse_confidence, scoreFlags);
      const categoryReady = categoryCanEnterPool(readinessMap, parsed?.category);
      const skipReason = poolSkipReason({
        profitMin,
        price,
        skuMedian,
        riskHits: Number(analysis?.risk_hits ?? 0),
        thumbnailUrl: l.thumbnail_url,
        categoryCanEnterPool: categoryReady,
        categoryReason: `category_${parsed?.category ?? "missing"}_not_ready`,
        comparableKey: parsed?.comparable_key,
        needsReview: Boolean(parsed?.needs_review),
        confidence,
        scoreFlags,
      });
      if (skipReason) {
        totalSkipped += 1;
        continue;
      }
      poolRows.push({
        pid,
        profit_band: band,
        category: parsed.category,
        expected_profit_min: profitMin,
        expected_profit_max: profitMax,
        score: Number(analysis?.score ?? 0),
        confidence,
        comparable_key: parsed.comparable_key,
        max_exposure: poolMaxExposure(band),
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
