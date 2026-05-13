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
  skuId: "home-appliance-roborock-s8-pro-ultra",
  queries: [
    "로보락 S8 Pro Ultra",
    "Roborock S8 Pro Ultra",
    "로보락 S8프로울트라",
    "로보락 S8 프로 울트라",
    "Roborock S8 ProUltra",
    "로보락 S8 Pro",
    "Roborock S8 Pro",
    "로보락 로봇청소기 S8",
    "로보락 s8 pro ultra",
    "로보락 프로울트라",
    "로보락 플래그십",
    "로보락 s8pu",
    "로보락 S8PU",
    "로보락 S8 프로",
    "로보락 로봇 청소기",
    "로보락",
  ],
  priceMin: 350_000,
  priceMax: 1_400_000,
};

const HARD_REJECT_KEYWORDS = [
  "풀세트", "풀구성",
  "걸레만", "솔만", "필터만", "배터리만", "충전기만", "거치대만", "케이스만", "박스만",
  "도크만", "충전도크",
  "어댑터만", "케이블만", "스탠드만", "부품용", "파손", "고장", "침수", "수리이력",
  "매입", "삽니다", "구해요", "구매합니다", "구합니다",
  // S8 다른 변형 격리
  "s8 maxv", "s8maxv", "s8 max v",
  "s8+", "s8 plus", "s8plus",
  // 다른 세대/시리즈
  "s7", "s6", "s5",
  "qrevo", "q revo", "q5", "q7", "q8",
  "g10", "g20", "h7",
  // 타 브랜드 robot vac
  "다이슨", "dyson", "샤오미", "xiaomi", "dreame", "드리미", "ecovacs", "에코백스",
  "lg 코드제로", "lg 코드 제로", "삼성 비스포크",
  "사운드바", "soundbar",
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
  console.log(`existing Roborock S8 Pro Ultra pids: ${skipPids.size}`);

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
    // require roborock + s8 + (pro ultra)
    const hasBrand = norm.includes("로보락") || norm.includes("roborock");
    const hasS8 = norm.includes("s8");
    const hasProUltra = norm.includes("proultra") || norm.includes("pro 울트라") || norm.includes("프로울트라") || norm.includes("프로 울트라") || (norm.includes("pro") && norm.includes("ultra"));
    if (!(hasBrand && hasS8 && hasProUltra)) continue;
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
    if (!parsed.comparableKey || !parsed.comparableKey.startsWith("home_appliance|")) {
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
      query: `wave21_home_appliance_roborock_s8_pro_ultra_boost:${TARGET.skuId}`, source: "bunjang",
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
      raw_json: { source: "wave21_home_appliance_roborock_s8_pro_ultra_boost", lane: TARGET.skuId },
    });
    parsedRows.push(toParsedListingRow(cand.pid, parsed));
  }

  if (applyMode && rawRows.length > 0) {
    if (process.env.WAVE21_WRITE_APPROVED !== "1") throw new Error("Apply refused: set WAVE21_WRITE_APPROVED=1");
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
    category: "wave21_home_appliance_roborock_s8_pro_ultra_boost",
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
  const jsonPath = path.join(reportsDir, "wave21-home-appliance-roborock-s8-pro-ultra-boost-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  console.log(`wave21 roborock s8 pro ultra: collected=${items.size}, validated=${validated.length}, applied=${applyMode ? rawRows.length : 0}, expectedKeys=${[...expectedKeys].join(",")}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
