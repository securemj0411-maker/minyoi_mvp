import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectSearchItems, fetchDetail } from "@/lib/bunjang";
import { ruleMatch, skuById } from "@/lib/catalog";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";
import { describeSignals, detectSoldOut, isSoldOut } from "@/lib/sold-out";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");
const applyMode = process.argv.includes("--apply=1");

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}

type SkuTarget = {
  skuId: string;
  expectedComparableKey: string;
  queries: string[];
  priceMin: number;
  priceMax: number;
};

const TARGETS: SkuTarget[] = [
  {
    skuId: "monitor-xl2540k",
    expectedComparableKey: "monitor|xl2540k|24_5in|fhd|240hz|tn|unknown_shape",
    queries: ["XL2540K", "벤큐 XL2540K", "ZOWIE XL2540K", "XL2540", "벤큐 ZOWIE 240", "BenQ XL2540"],
    priceMin: 100_000, priceMax: 600_000,
  },
  {
    skuId: "monitor-27gl650f",
    expectedComparableKey: "monitor|27gl650f|27in|fhd|144hz|ips|unknown_shape",
    queries: ["27GL650F", "LG 27GL650F", "울트라기어 27GL650F", "27GL650", "LG 27 144Hz", "lg 울트라기어 27인치"],
    priceMin: 50_000, priceMax: 250_000,
  },
  {
    skuId: "monitor-27us550",
    expectedComparableKey: "monitor|27us550|27in|uhd_4k|60hz|ips|unknown_shape",
    queries: ["27US550", "LG 27US550", "LG 27US550-W", "27US550W", "LG 27 4K", "LG UHD 27인치"],
    priceMin: 80_000, priceMax: 400_000,
  },
  {
    skuId: "monitor-39gx900a",
    expectedComparableKey: "monitor|39gx900a|39in|wqhd|240hz|oled|curved_ultrawide",
    queries: ["39GX900A", "LG 39GX900A", "LG OLED 39", "GX900A", "39 OLED 240"],
    priceMin: 600_000, priceMax: 2_500_000,
  },
];

const HARD_REJECT_KEYWORDS = [
  "풀세트", "풀구성", "풀패키지",
  "스탠드만", "마운트만", "모니터암만", "스탠드 단품", "vesa만",
  "케이스만", "박스만", "박스 only", "어댑터만", "케이블만", "리모컨만",
  "부품용", "부품 용", "파손", "액정파손", "액정 파손", "고장", "침수", "수리이력",
  "매입", "삽니다", "구해요", "구매합니다", "구합니다",
  "리퍼폰", "리퍼 폰", "리퍼 제품", "리퍼수령",
  "교환문의", "교환 문의", "분실",
];

const SOFT_HOLD_KEYWORDS = ["미개봉", "박스개봉", "새제품 미사용"]; // 단가 outlier 가능, but allow

function hasHardReject(text: string): string | null {
  const norm = text.toLowerCase().replace(/\s+/g, " ");
  for (const kw of HARD_REJECT_KEYWORDS) {
    if (norm.includes(kw.toLowerCase())) return kw;
  }
  return null;
}

function isActiveSaleStatus(status: string | null | undefined) {
  return ["SELLING", "AVAILABLE", "ON_SALE", "ACTIVE"].includes(String(status ?? "").trim().toUpperCase());
}

async function postRows(table: string, rows: Record<string, unknown>[], onConflict: string) {
  if (rows.length === 0) return;
  const res = await restFetch(`${tableUrl(table)}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: serviceHeaders("resolution=merge-duplicates,return=minimal"),
    body: jsonBody(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${table} upsert failed: ${res.status} ${text.slice(0, 300)}`);
  }
}

async function existingPids(): Promise<Set<number>> {
  const res = await restFetch(
    `${tableUrl("mvp_raw_listings")}?select=pid&sku_id=in.(monitor-xl2540k,monitor-27gl650f,monitor-27us550,monitor-39gx900a)`,
    { headers: serviceHeaders() },
  );
  const rows = (await res.json()) as Array<{ pid: number }>;
  return new Set(rows.map((r) => Number(r.pid)));
}

type Candidate = {
  pid: number;
  target: SkuTarget;
  title: string;
  price: number;
  url: string;
  numFaved: number;
  freeShipping: boolean;
  rejectReason?: string;
  acceptReason?: string;
  freshDetail?: Awaited<ReturnType<typeof fetchDetail>>;
};

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));

  const startedAt = new Date().toISOString();
  const skipPids = await existingPids();
  console.log(`existing monitor pids (skip dedupe): ${skipPids.size}`);

  // Step 1: collect search items per target
  const candidates: Candidate[] = [];
  const perTargetCollected: Record<string, number> = {};
  for (const target of TARGETS) {
    const items = await collectSearchItems(target.queries, 3, 250);
    perTargetCollected[target.skuId] = items.size;
    for (const item of items.values()) {
      const pid = Number(item.pid);
      if (!Number.isFinite(pid) || pid <= 0) continue;
      if (skipPids.has(pid)) continue;
      if (item.price < target.priceMin || item.price > target.priceMax) continue;
      const hard = hasHardReject(item.name);
      if (hard) continue;
      // pre-filter: title must contain target token (or close variant)
      const titleHit = target.queries.some((q) =>
        item.name.toLowerCase().replace(/\s+/g, "").includes(q.toLowerCase().replace(/\s+/g, "").slice(0, 6)),
      );
      if (!titleHit) continue;
      candidates.push({
        pid,
        target,
        title: item.name,
        price: item.price,
        url: item.url,
        numFaved: item.numFaved,
        freeShipping: item.freeShipping,
      });
    }
  }
  console.log(`search candidates (post pre-filter): ${candidates.length}`);

  // Step 2: detail fetch + strict validation
  const validated: Candidate[] = [];
  for (const cand of candidates) {
    const fresh = await fetchDetail(String(cand.pid));
    if (!fresh) { cand.rejectReason = "fresh_fetch_failed"; continue; }
    if (!isActiveSaleStatus(fresh.saleStatus)) { cand.rejectReason = `inactive:${fresh.saleStatus ?? "missing"}`; continue; }
    const description = fresh.description ?? "";
    const fullText = `${cand.title}\n${description}`;
    const hard = hasHardReject(fullText);
    if (hard) { cand.rejectReason = `hard_reject:${hard}`; continue; }
    const soldSignals = detectSoldOut(fresh, cand.price, { title: cand.title });
    if (isSoldOut(soldSignals)) { cand.rejectReason = `sold:${describeSignals(soldSignals)}`; continue; }
    const classified = classifyListing(cand.title, description, cand.price);
    if (classified.listingType !== "normal") { cand.rejectReason = `listing_type:${classified.listingType}`; continue; }
    const matched = ruleMatch(cand.title, description);
    if (!matched || matched.id !== cand.target.skuId) {
      cand.rejectReason = `sku_mismatch:${matched?.id ?? "null"}`;
      continue;
    }
    const parsed = parseListingOptions({
      title: cand.title,
      description,
      skuId: matched.id,
      skuName: matched.modelName,
      category: matched.category,
    });
    if (parsed.needsReview) { cand.rejectReason = "parsed_needs_review"; continue; }
    if (parsed.comparableKey !== cand.target.expectedComparableKey) {
      cand.rejectReason = `comparable_key_mismatch:${parsed.comparableKey ?? "null"}`;
      continue;
    }
    cand.freshDetail = fresh;
    cand.acceptReason = "fresh_validated";
    validated.push(cand);
  }
  console.log(`validated candidates: ${validated.length}`);

  // Step 3: build raw + parsed payloads
  const now = new Date().toISOString();
  const rawRows: Record<string, unknown>[] = [];
  const parsedRows: Record<string, unknown>[] = [];
  for (const cand of validated) {
    const fresh = cand.freshDetail!;
    const matched = skuById(cand.target.skuId)!;
    const parsed = parseListingOptions({
      title: cand.title,
      description: fresh.description ?? "",
      skuId: matched.id,
      skuName: matched.modelName,
      category: matched.category,
    });
    rawRows.push({
      pid: cand.pid,
      url: cand.url,
      name: cand.title,
      price: cand.price,
      num_faved: cand.numFaved,
      free_shipping: cand.freeShipping,
      query: `wave11_monitor_boost:${cand.target.skuId}`,
      source: "bunjang",
      description_preview: fresh.description ?? "",
      sale_status: fresh.saleStatus ?? "",
      seller_source: "bunjang",
      shop_review_rating: fresh.shopReviewRating ?? null,
      shop_review_count: fresh.shopReviewCount ?? 0,
      seller_uid: fresh.shopUid ?? null,
      seller_name: fresh.shopName ?? null,
      trade_data: fresh.tradeData ?? null,
      trades_data: fresh.tradesData ?? null,
      image_url_template: fresh.imageUrlTemplate ?? null,
      image_count: fresh.imageCount ?? 0,
      thumbnail_url: fresh.thumbnailUrl ?? null,
      listing_type: "normal",
      sku_id: matched.id,
      sku_name: matched.modelName,
      detail_status: "done",
      detail_enriched_at: now,
      listing_state: "active",
      pool_eligible: false,
      score_dirty: true,
      last_seen_at: now,
      last_changed_at: now,
      updated_at: now,
      raw_json: { source: "wave11_monitor_boost", lane: cand.target.skuId },
    });
    parsedRows.push(toParsedListingRow(cand.pid, parsed));
  }

  // Step 4: write (only when --apply=1)
  if (applyMode && rawRows.length > 0) {
    if (process.env.WAVE11_WRITE_APPROVED !== "1") {
      throw new Error("Apply refused: set WAVE11_WRITE_APPROVED=1");
    }
    await postRows("mvp_raw_listings", rawRows, "pid");
    await postRows("mvp_listing_parsed", parsedRows, "pid");
    console.log(`upserted raw=${rawRows.length} parsed=${parsedRows.length}`);
  }

  const perTargetValidated: Record<string, number> = {};
  for (const cand of validated) {
    perTargetValidated[cand.target.skuId] = (perTargetValidated[cand.target.skuId] ?? 0) + 1;
  }
  const rejectionHistogram: Record<string, number> = {};
  for (const cand of candidates) {
    if (!cand.rejectReason) continue;
    const key = cand.rejectReason.split(":")[0];
    rejectionHistogram[key] = (rejectionHistogram[key] ?? 0) + 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    startedAt,
    reportOnly: !applyMode,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "wave11_monitor_sku_sample_boost",
    family: "monitor_market_sample_depth",
    decision: applyMode
      ? "wave11_monitor_sku_sample_boost_apply"
      : "wave11_monitor_sku_sample_boost_dry_run",
    metrics: {
      candidatesPreFilter: candidates.length,
      validated: validated.length,
      upsertedRaw: applyMode ? rawRows.length : 0,
      upsertedParsed: applyMode ? parsedRows.length : 0,
      runtimeApprovedRows: 0,
    },
    perTargetCollected,
    perTargetValidated,
    rejectionHistogram,
    validatedPids: validated.map((c) => ({ pid: c.pid, sku: c.target.skuId, price: c.price, title: c.title.slice(0, 80) })),
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "wave11-monitor-sku-sample-boost-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  console.log(
    `wave11 monitor boost: candidates=${candidates.length}, validated=${validated.length}, applied=${applyMode ? rawRows.length : 0}, perTarget=${JSON.stringify(perTargetValidated)}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
