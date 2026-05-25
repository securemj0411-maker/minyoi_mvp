import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildCandidatePoolRows } from "@/lib/candidate-pool-builder";
import { loadCategoryReadinessMap, loadLaneReadinessMap } from "@/lib/category-readiness";
import { CATALOG, type Sku } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";
import { restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const READ_CHUNK = 700;
const WRITE_CHUNK = 300;

const RECOVERABLE_REASONS = new Set([
  "sku_median_unavailable",
  "wave99_thin_market_n_lt_5",
  "profit_below_pack_band",
  "negative_resell_gap",
  "pool_eligible_false_residue",
  "wave410_pool_key_drift",
  "wave498_stale_comparable_key",
  "wave500_stale_or_review_comparable_key",
  "wave501_stale_pool_cleanup",
  "wave501_final_ready_sample_qa",
  "wave804_parsed_key_drift",
  "wave226_wrong_sku_match_cleanup",
  "wave230_sku_id_null_stale",
  "blocked_deep_discount_review",
  "fashion_unknown_condition_review",
  "fashion_broad_sku_review",
]);

type PoolRow = {
  pid: number;
  category: Sku["category"] | null;
  invalidated_reason: string | null;
};

type RawRow = {
  pid: number;
  source: string | null;
  query: string | null;
  name: string | null;
  price: number | null;
  free_shipping: boolean | null;
  url: string | null;
  seller_uid: string | null;
  thumbnail_url: string | null;
  description_preview: string | null;
  shop_review_rating: number | null;
  shop_review_count: number | null;
  image_count: number | null;
  sku_id: string | null;
  detail_status: string | null;
  listing_state: string | null;
  listing_type: string | null;
  listing_type_override: string | null;
  sale_status: string | null;
  num_comment: number | null;
  qty: number | null;
  description_hash: string | null;
  pool_eligible: boolean | null;
  first_seen_at: string | null;
};

type ListingRow = {
  pid: number;
  name: string | null;
  price: number | null;
  sku_median: number | null;
  shipping_fee: number | null;
  shipping_fee_general: number | null;
  estimated_buy_cost: number | null;
  description_preview: string | null;
  image_count: number | null;
  thumbnail_url: string | null;
};

type AnalysisRow = {
  pid: number;
  risk_hits: number | null;
  score: number | null;
  score_flags: unknown;
};

type ParsedRow = {
  pid: number;
  parser_version: string | null;
  category: Sku["category"] | null;
  comparable_key: string | null;
  parse_confidence: number | null;
  needs_review: boolean | null;
  parsed_json: Record<string, unknown> | null;
  condition_class: string | null;
};

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      process.env[key] ??= rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Optional env file.
  }
}

function argValue(name: string) {
  const prefix = `--${name}=`;
  const exact = process.argv.find((arg) => arg.startsWith(prefix));
  if (exact) return exact.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function intArg(name: string, fallback: number) {
  const raw = argValue(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function inc(map: Record<string, number>, key: string | null | undefined) {
  const k = key || "(null)";
  map[k] = (map[k] ?? 0) + 1;
}

function top(map: Record<string, number>, limit = 16) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function isRecoverableReason(reason: string | null) {
  if (!reason) return false;
  return reason.startsWith("stale_parser_version_") || RECOVERABLE_REASONS.has(reason);
}

function isRawEligible(raw: RawRow | undefined) {
  if (!raw) return false;
  const normal = raw.listing_type === "normal" || raw.listing_type_override === "normal";
  return raw.detail_status === "done" &&
    raw.listing_state === "active" &&
    normal &&
    raw.pool_eligible !== false &&
    Boolean(raw.sku_id);
}

function parserExpectedByCategory() {
  const byCategory = new Map<Sku["category"], string>();
  for (const sku of CATALOG) {
    if (byCategory.has(sku.category)) continue;
    const parsed = parseListingOptions({
      title: sku.modelName,
      description: "",
      skuId: sku.id,
      skuName: sku.modelName,
      category: sku.category,
      defaultProductType: sku.defaultProductType ?? null,
    });
    byCategory.set(sku.category, parsed.parserVersion);
  }
  return Object.fromEntries([...byCategory.entries()]) as Partial<Record<Sku["category"], string>>;
}

async function fetchAll<T extends Record<string, unknown>>(baseUrl: string, pageSize = 1000): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const res = await restFetch(`${baseUrl}${sep}limit=${pageSize}&offset=${offset}`, {
      headers: serviceHeaders(),
    });
    const page = (await res.json()) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function fetchByPids<T extends { pid: number }>(table: string, select: string, pids: number[]) {
  const rows: T[] = [];
  for (const part of chunk([...new Set(pids)].filter(Number.isFinite), READ_CHUNK)) {
    if (part.length === 0) continue;
    const res = await restFetch(
      `${tableUrl(table)}?select=${select}&pid=in.(${part.join(",")})&limit=${part.length}`,
      { headers: serviceHeaders() },
    );
    rows.push(...((await res.json()) as T[]));
  }
  return new Map(rows.map((row) => [Number(row.pid), row]));
}

async function loadExistingPoolSellerCounts() {
  const counts = new Map<string, number>();
  const poolRows = await fetchAll<{ pid: number }>(
    `${tableUrl("mvp_candidate_pool")}?select=pid&status=eq.ready&order=pid.asc`,
  );
  for (const part of chunk(poolRows.map((row) => Number(row.pid)).filter(Number.isFinite), READ_CHUNK)) {
    const rawRes = await restFetch(
      `${tableUrl("mvp_raw_listings")}?select=seller_uid&pid=in.(${part.join(",")})&seller_uid=not.is.null&limit=${part.length}`,
      { headers: serviceHeaders() },
    );
    const rawRows = (await rawRes.json()) as Array<{ seller_uid: string | null }>;
    for (const row of rawRows) {
      if (row.seller_uid) counts.set(row.seller_uid, (counts.get(row.seller_uid) ?? 0) + 1);
    }
  }
  return counts;
}

async function loadFraudGroupHashes() {
  try {
    const res = await fetch(rpcUrl("get_fraud_group_hashes"), {
      method: "POST",
      headers: serviceHeaders(),
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return new Set<string>();
    const rows = (await res.json()) as Array<{ description_hash: string | null }>;
    return new Set(rows.map((row) => row.description_hash).filter((hash): hash is string => Boolean(hash)));
  } catch {
    return new Set<string>();
  }
}

async function loadLowVolumeSkuIds() {
  const since7dIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const since2dMs = Date.now() - 2 * 24 * 3600 * 1000;
  const rows = await fetchAll<{ sku_id: string; first_seen_at: string }>(
    `${tableUrl("mvp_raw_listings")}?select=sku_id,first_seen_at&sku_id=not.is.null&first_seen_at=gte.${encodeURIComponent(since7dIso)}&listing_state=eq.active&or=(sku_id.like.shoe-%2A,sku_id.like.clothing-%2A,sku_id.like.bag-%2A)&order=first_seen_at.desc`,
  );
  const d7 = new Map<string, number>();
  const d2 = new Map<string, number>();
  for (const row of rows) {
    if (!row.sku_id) continue;
    d7.set(row.sku_id, (d7.get(row.sku_id) ?? 0) + 1);
    const ts = Date.parse(row.first_seen_at);
    if (Number.isFinite(ts) && ts >= since2dMs) d2.set(row.sku_id, (d2.get(row.sku_id) ?? 0) + 1);
  }
  const low = new Set<string>();
  for (const [skuId, count7] of d7.entries()) {
    if (count7 < 3 || (d2.get(skuId) ?? 0) < 1) low.add(skuId);
  }
  return low;
}

async function upsertPoolEntries(entries: Record<string, unknown>[]) {
  for (const part of chunk(entries, WRITE_CHUNK)) {
    await restFetch(`${tableUrl("mvp_candidate_pool")}?on_conflict=pid`, {
      method: "POST",
      headers: serviceHeaders("resolution=merge-duplicates,return=minimal"),
      body: JSON.stringify(part),
    });
  }
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));

  const apply = hasFlag("apply");
  const limit = intArg("limit", 0);
  const categoriesArg = argValue("categories");
  const categoryAllow = categoriesArg
    ? new Set(categoriesArg.split(",").map((item) => item.trim()).filter(Boolean))
    : null;
  const pidsArg = argValue("pids");
  const pidAllow = pidsArg
    ? new Set(pidsArg.split(",").map((item) => Number(item.trim())).filter(Number.isFinite))
    : null;
  const now = new Date().toISOString();
  const latestParserVersionByCategory = parserExpectedByCategory();
  const catalogById = new Map(CATALOG.map((sku) => [sku.id, sku]));

  const poolRows = await fetchAll<PoolRow>(
    `${tableUrl("mvp_candidate_pool")}?select=pid,category,invalidated_reason&status=eq.invalidated&order=updated_at.desc`,
  );
  const recoveryPoolRows = poolRows.filter((row) => {
    const explicitlyAllowedPid = pidAllow?.has(Number(row.pid)) ?? false;
    const recoverable = isRecoverableReason(row.invalidated_reason) ||
      (explicitlyAllowedPid && row.invalidated_reason === "wave410_category_internal_only_shoe");
    return recoverable &&
      (!categoryAllow || categoryAllow.has(String(row.category ?? ""))) &&
      (!pidAllow || explicitlyAllowedPid);
  });
  const candidatePids = [...new Set(recoveryPoolRows.map((row) => Number(row.pid)).filter(Number.isFinite))];

  const [rawByPid, listingByPid, analysisByPid, parsedByPidRaw] = await Promise.all([
    fetchByPids<RawRow>(
      "mvp_raw_listings",
      "pid,source,query,name,price,free_shipping,url,seller_uid,thumbnail_url,description_preview,shop_review_rating,shop_review_count,image_count,sku_id,detail_status,listing_state,listing_type,listing_type_override,sale_status,num_comment,qty,description_hash,pool_eligible,first_seen_at",
      candidatePids,
    ),
    fetchByPids<ListingRow>(
      "mvp_listings",
      "pid,name,price,sku_median,shipping_fee,shipping_fee_general,estimated_buy_cost,description_preview,image_count,thumbnail_url",
      candidatePids,
    ),
    fetchByPids<AnalysisRow>(
      "mvp_listing_analysis",
      "pid,risk_hits,score,score_flags",
      candidatePids,
    ),
    fetchByPids<ParsedRow>(
      "mvp_listing_parsed",
      "pid,parser_version,category,comparable_key,parse_confidence,needs_review,parsed_json,condition_class",
      candidatePids,
    ),
  ]);

  const reasonByPid = new Map(recoveryPoolRows.map((row) => [Number(row.pid), row.invalidated_reason]));
  const eligiblePids = candidatePids.filter((pid) => isRawEligible(rawByPid.get(pid)));
  const rows = eligiblePids.map((pid) => {
    const raw = rawByPid.get(pid)!;
    const listing = listingByPid.get(pid);
    const analysis = analysisByPid.get(pid);
    const price = Number(listing?.price ?? raw.price ?? 0);
    const scoreFlags = Array.isArray(analysis?.score_flags) ? analysis.score_flags.map(String) : [];
    return {
      pid,
      name: listing?.name ?? raw.name,
      price,
      skuMedian: Number(listing?.sku_median ?? 0),
      estimatedBuyCost: Number(listing?.estimated_buy_cost ?? price),
      shippingFee: Number(listing?.shipping_fee ?? 0),
      shippingFeeGeneral: listing?.shipping_fee_general == null ? null : Number(listing.shipping_fee_general),
      riskHits: Number(analysis?.risk_hits ?? 0),
      thumbnailUrl: listing?.thumbnail_url ?? raw.thumbnail_url,
      source: raw.source,
      poolEligible: raw.pool_eligible,
      poolEligibleFalseStale: false,
      skuId: raw.sku_id,
      score: Number(analysis?.score ?? 0),
      scoreFlags,
      saleStatus: raw.sale_status,
      numComment: raw.num_comment,
      qty: raw.qty,
      sellerUid: raw.seller_uid,
      descriptionHash: raw.description_hash,
      shopReviewCount: raw.shop_review_count,
      shopReviewRating: raw.shop_review_rating,
      descriptionPreview: listing?.description_preview ?? raw.description_preview,
      imageCount: listing?.image_count ?? raw.image_count,
    };
  });

  const parsedByPid = new Map<number, ParsedRow>();
  for (const [pid, row] of parsedByPidRaw.entries()) parsedByPid.set(pid, row);

  const [categoryReadiness, laneReadiness, existingPoolSellerCounts, fraudGroupHashes, lowVolumeSkuIds] = await Promise.all([
    loadCategoryReadinessMap(),
    loadLaneReadinessMap(),
    loadExistingPoolSellerCounts(),
    loadFraudGroupHashes(),
    loadLowVolumeSkuIds(),
  ]);

  const built = buildCandidatePoolRows({
    rows,
    parsedByPid,
    catalogById,
    categoryReadiness,
    laneReadiness,
    now,
    latestParserVersionByCategory,
    existingPoolSellerCounts,
    fraudGroupHashes,
    lowVolumeSkuIds,
  });

  const accepted = limit > 0 ? built.entries.slice(0, limit) : built.entries;
  if (apply && accepted.length > 0) await upsertPoolEntries(accepted);

  const acceptedByReason: Record<string, number> = {};
  const acceptedByCategory: Record<string, number> = {};
  for (const entry of accepted) {
    inc(acceptedByReason, reasonByPid.get(Number(entry.pid)) ?? null);
    inc(acceptedByCategory, String(entry.category ?? "(null)"));
  }

  const currentReady = await fetchAll<{ pid: number; profit_band: number | null; category: string | null }>(
    `${tableUrl("mvp_candidate_pool")}?select=pid,profit_band,category&status=eq.ready&order=pid.asc`,
  );
  const readyByCategory: Record<string, number> = {};
  const readyByBand: Record<string, number> = {};
  for (const row of currentReady) {
    inc(readyByCategory, row.category);
    inc(readyByBand, `band${row.profit_band ?? "(null)"}`);
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    invalidatedRows: poolRows.length,
    recoverableRows: recoveryPoolRows.length,
    eligibleRows: eligiblePids.length,
    buildAccepted: built.entries.length,
    applied: apply ? accepted.length : 0,
    limitedTo: limit || null,
    acceptedByReason: top(acceptedByReason),
    acceptedByCategory: top(acceptedByCategory),
    skipReasons: top(built.skipReasonCounts),
    currentReadyAfterRun: currentReady.length,
    currentReadyByBand: top(readyByBand),
    currentReadyByCategory: top(readyByCategory),
    sampleAccepted: accepted.slice(0, 20).map((entry) => ({
      pid: entry.pid,
      category: entry.category,
      band: entry.profit_band,
      profitMin: entry.expected_profit_min,
      key: entry.comparable_key,
      recoveredFrom: reasonByPid.get(Number(entry.pid)),
    })),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
