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
  skuId: "ipad-pro-11-m4-256-wifi",
  queries: [
    "아이패드 프로 11 M4",
    "iPad Pro 11 M4",
    "아이패드프로 11 M4",
    "아이패드 프로 M4 11",
    "iPad Pro M4 11",
    "아이패드 프로 11인치 M4",
    "아이패드 프로 11 M4 256",
    "iPad Pro 11 M4 256GB",
    "Apple iPad Pro 11 M4",
    "아이패드프로 m4",
  ],
  priceMin: 1_000_000,
  priceMax: 2_200_000,
};

const HARD_REJECT_KEYWORDS = [
  "어댑터만", "케이블만", "스탠드만", "박스만", "케이스만", "거치대만", "필름만",
  "부품용", "파손", "고장", "수리이력", "액정파손", "액정만", "배터리만", "메인보드", "로직보드", "상판", "하판",
  "매입", "삽니다", "구해요", "구매합니다", "구합니다",
  // 다른 chip 격리 (M1/M2/M3/A-시리즈/Intel은 iPad 아님)
  "(m1)", "m1 아이패드", "아이패드 m1", "ipad m1", "m1 ipad", "m1세대", "m1 칩",
  "(m2)", "m2 아이패드", "아이패드 m2", "ipad m2", "m2 ipad", "m2세대", "m2 칩",
  "(m3)", "m3 아이패드", "아이패드 m3", "ipad m3", "m3 ipad", "m3세대", "m3 칩",
  "a16 bionic", "a15 bionic", "a14 bionic", "a13 bionic",
  // 다른 iPad 라인업 격리
  "아이패드 에어", "ipad air", "아이패드에어", "아이패드 미니", "ipad mini", "아이패드미니",
  "아이패드 10", "ipad 10", "아이패드 9", "ipad 9", "아이패드 8", "ipad 8", "아이패드 7세대",
  // 13"/12.9" / Cellular 격리
  "13인치", "13형", "13\"", "13in", "12.9인치", "12.9 인치", "12.9\"", "12.9in",
  "셀룰러", "cellular", " lte ", " 5g ", "유심", "esim",
  // 다른 용량 격리 (M4 256GB Wi-Fi narrow lane)
  "128gb", "128 gb", "128기가",
  "512gb", "512 gb", "512기가",
  "1tb", "1 tb", "1테라", "2tb", "2 tb", "2테라",
  // 다른 카테고리 / 액세서리
  "맥북", "macbook", "아이폰", "iphone", "갤럭시", "samsung",
  "애플펜슬만", "펜슬만", "키보드만", "매직키보드만", "스마트키보드만", "smart keyboard",
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
  console.log(`existing iPad Pro 11 M4 256 WiFi pids: ${skipPids.size}`);

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
    // require iPad Pro + M4 + 11 + 256
    const hasIpadPro = (norm.includes("아이패드") && norm.includes("프로")) || (norm.includes("ipad") && norm.includes("pro")) || norm.includes("아이패드프로") || norm.includes("ipadpro");
    const hasM4 = norm.includes("m4");
    const has11 = norm.includes("11인치") || norm.includes("11형") || /\b11\b/.test(item.name.toLowerCase()) || norm.includes("11ipad") || norm.includes("ipad11") || norm.includes("11아이패드") || norm.includes("아이패드11");
    const has256 = norm.includes("256");
    if (!(hasIpadPro && hasM4 && has11 && has256)) continue;
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
    if (!parsed.comparableKey || !parsed.comparableKey.startsWith("ipad|")) {
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
      query: `wave26_tablet_ipad_pro_11_m4_256_wifi_boost:${TARGET.skuId}`, source: "bunjang",
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
      raw_json: { source: "wave26_tablet_ipad_pro_11_m4_256_wifi_boost", lane: TARGET.skuId },
    });
    parsedRows.push(toParsedListingRow(cand.pid, parsed));
  }

  if (applyMode && rawRows.length > 0) {
    if (process.env.WAVE26_WRITE_APPROVED !== "1") throw new Error("Apply refused: set WAVE26_WRITE_APPROVED=1");
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
    category: "wave26_tablet_ipad_pro_11_m4_256_wifi_boost",
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
  console.log("histogram:", JSON.stringify(histogram));
  console.log("expected_keys:", [...expectedKeys].join(","));
  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "wave21-ipad-pro-11-m4-256-wifi-boost-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  console.log(`wave26 ipad pro 11 m4 256 wifi: collected=${items.size}, validated=${validated.length}, applied=${applyMode ? rawRows.length : 0}, expectedKeys=${[...expectedKeys].join(",")}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
