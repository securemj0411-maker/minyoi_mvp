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

const TARGET = {
  skuId: "camera-sony-a7m3",
  queries: [
    "Sony A7M3",
    "소니 A7M3",
    "A7 III 바디",
    "A7M3 바디",
    "소니 A7 III",
    "ILCE-7M3",
    "a7m3 body",
    "소니 A7M3 바디",
    "a7m3",
    "a7iii",
    "소니 a7iii",
    "A7M3 바디만",
    "A7 III body",
    "소니 풀프레임 A7M3",
    "Sony Alpha A7 III",
    "알파 A7M3",
  ],
  priceMin: 700_000,
  priceMax: 1_800_000,
};

const HARD_REJECT_KEYWORDS = [
  "풀세트", "풀구성",
  "케이스만", "박스만", "어댑터만", "케이블만", "스탠드만", "스트랩만",
  "부품용", "부품 용", "파손", "고장", "침수", "수리이력", "액정파손", "센서먼지",
  "매입", "삽니다", "구해요", "구매합니다", "구합니다",
  // 다른 Sony body / variant 제외
  "a7m2", "a7m4", "a7m5", "a7r3", "a7r iii", "a7r4", "a7r iv", "a7r5",
  "a7s3", "a7s iii", "a7s2", "a7c2", "a7cii", "a7c ii", "a9",
  "fx3", "fx30", "zv-e10", "zv-1",
  "canon", "캐논", "nikon", "니콘", "fujifilm", "후지",
  // lens kit/번들 차단
  "렌즈킷", "렌즈 킷", "lens kit", "kit lens",
  "28-70", "28 70", "sel28-70", "sel 28-70",
  "24-70", "24 70", "24-105", "24 105",
  "50mm", "50 mm", "sel50", "sel 50",
  "탐론", "tamron", "시그마", "sigma",
];

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
    `${tableUrl("mvp_raw_listings")}?select=pid&sku_id=eq.${TARGET.skuId}`,
    { headers: serviceHeaders() },
  );
  const rows = (await res.json()) as Array<{ pid: number }>;
  return new Set(rows.map((r) => Number(r.pid)));
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));

  const startedAt = new Date().toISOString();
  const skipPids = await existingPids();
  console.log(`existing Sony A7M3 pids: ${skipPids.size}`);

  const items = await collectSearchItems(TARGET.queries, 3, 250);
  console.log(`search collected (dedupe): ${items.size}`);

  type C = { pid: number; title: string; price: number; url: string; numFaved: number; freeShipping: boolean; rejectReason?: string; fresh?: Awaited<ReturnType<typeof fetchDetail>>; comparableKey?: string };
  const candidates: C[] = [];
  for (const item of items.values()) {
    const pid = Number(item.pid);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    if (skipPids.has(pid)) continue;
    if (item.price < TARGET.priceMin || item.price > TARGET.priceMax) continue;
    if (hasHardReject(item.name)) continue;
    const norm = item.name.toLowerCase().replace(/\s+/g, "");
    // require A7M3 model token (a7m3, a7iii, a73, ilce7m3)
    const hasModel = norm.includes("a7m3") || norm.includes("a7iii") || norm.includes("a73") || norm.includes("ilce7m3") || norm.includes("ilce-7m3");
    if (!hasModel) continue;
    // require body marker
    const hasBody = norm.includes("바디") || norm.includes("body");
    if (!hasBody) continue;
    candidates.push({ pid, title: item.name, price: item.price, url: item.url, numFaved: item.numFaved, freeShipping: item.freeShipping });
  }
  console.log(`pre-filter pass: ${candidates.length}`);

  const validated: C[] = [];
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
    if (!matched || matched.id !== TARGET.skuId) { cand.rejectReason = `sku_mismatch:${matched?.id ?? "null"}`; continue; }
    const parsed = parseListingOptions({ title: cand.title, description, skuId: matched.id, skuName: matched.modelName, category: matched.category });
    if (parsed.needsReview) { cand.rejectReason = `parsed_needs_review:${parsed.comparableKey ?? "null"}`; continue; }
    if (!parsed.comparableKey || !parsed.comparableKey.startsWith("camera|")) {
      cand.rejectReason = `comparable_key_unexpected:${parsed.comparableKey ?? "null"}`;
      continue;
    }
    cand.fresh = fresh;
    cand.comparableKey = parsed.comparableKey;
    validated.push(cand);
  }
  console.log(`validated: ${validated.length}`);

  const now = new Date().toISOString();
  const rawRows: Record<string, unknown>[] = [];
  const parsedRows: Record<string, unknown>[] = [];
  const matched = skuById(TARGET.skuId)!;
  const expectedKeys = new Set<string>();
  for (const cand of validated) {
    const fresh = cand.fresh!;
    const parsed = parseListingOptions({ title: cand.title, description: fresh.description ?? "", skuId: matched.id, skuName: matched.modelName, category: matched.category });
    if (parsed.comparableKey) expectedKeys.add(parsed.comparableKey);
    rawRows.push({
      pid: cand.pid, url: cand.url, name: cand.title, price: cand.price,
      num_faved: cand.numFaved, free_shipping: cand.freeShipping,
      query: `wave18_camera_sony_a7m3_boost:${TARGET.skuId}`, source: "bunjang",
      description_preview: fresh.description ?? "",
      sale_status: fresh.saleStatus ?? "",
      seller_source: "bunjang",
      shop_review_rating: fresh.shopReviewRating ?? null,
      shop_review_count: fresh.shopReviewCount ?? 0,
      seller_uid: fresh.shopUid ?? null, seller_name: fresh.shopName ?? null,
      trade_data: fresh.tradeData ?? null, trades_data: fresh.tradesData ?? null,
      image_url_template: fresh.imageUrlTemplate ?? null,
      image_count: fresh.imageCount ?? 0, thumbnail_url: fresh.thumbnailUrl ?? null,
      listing_type: "normal", sku_id: matched.id, sku_name: matched.modelName,
      detail_status: "done", detail_enriched_at: now,
      listing_state: "active", pool_eligible: true, score_dirty: true,
      last_seen_at: now, last_changed_at: now, updated_at: now,
      raw_json: { source: "wave18_camera_sony_a7m3_boost", lane: TARGET.skuId },
    });
    parsedRows.push(toParsedListingRow(cand.pid, parsed));
  }

  if (applyMode && rawRows.length > 0) {
    if (process.env.WAVE18_WRITE_APPROVED !== "1") throw new Error("Apply refused: set WAVE18_WRITE_APPROVED=1");
    await postRows("mvp_raw_listings", rawRows, "pid");
    await postRows("mvp_listing_parsed", parsedRows, "pid");
    console.log(`upserted raw=${rawRows.length} parsed=${parsedRows.length}`);
  }

  const histogram: Record<string, number> = {};
  for (const c of candidates) {
    if (!c.rejectReason) continue;
    const key = c.rejectReason.split(":")[0];
    histogram[key] = (histogram[key] ?? 0) + 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    startedAt,
    reportOnly: !applyMode,
    category: "wave18_camera_sony_a7m3_boost",
    metrics: {
      searchCollected: items.size,
      preFilterPass: candidates.length,
      validated: validated.length,
      applied: applyMode ? rawRows.length : 0,
    },
    rejectionHistogram: histogram,
    expectedComparableKeys: [...expectedKeys],
    validatedPids: validated.map((c) => ({ pid: c.pid, price: c.price, comparableKey: c.comparableKey, title: c.title.slice(0, 80) })),
  };
  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "wave18-camera-sony-a7m3-boost-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  console.log(`wave18 sony a7m3: collected=${items.size}, validated=${validated.length}, applied=${applyMode ? rawRows.length : 0}, expectedKeys=${[...expectedKeys].join(",")}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
