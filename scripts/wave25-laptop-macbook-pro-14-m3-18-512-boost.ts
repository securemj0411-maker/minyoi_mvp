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
  skuId: "macbook-pro-14-m3-18-512",
  queries: [
    "맥북프로 14 M3",
    "MacBook Pro 14 M3",
    "맥북프로 M3 14",
    "맥북프로 M3 Pro 14",
    "MacBook Pro M3 Pro 14",
    "맥북프로 14인치 M3",
    "맥북프로 14 M3 18",
    "맥북프로 14 M3 512",
    "Apple MacBook Pro 14 M3",
    "맥북 프로 14 M3",
  ],
  priceMin: 1_300_000,
  priceMax: 3_000_000,
};

const HARD_REJECT_KEYWORDS = [
  "어댑터만", "케이블만", "스탠드만", "박스만", "케이스만",
  "부품용", "파손", "고장", "수리이력", "액정파손", "액정만", "키보드만", "메인보드", "로직보드", "상판", "하판", "배터리만",
  "매입", "삽니다", "구해요", "구매합니다", "구합니다",
  // 다른 chip 격리 (M1/M2/M4/M3 Max/Intel)
  "(m1)", "m1 맥북", "맥북 m1", "macbook m1", "m1 macbook", "m1세대", "m1 칩",
  "(m2)", "m2 맥북", "맥북 m2", "macbook m2", "m2 macbook", "m2세대", "m2 칩",
  "(m4)", "m4 맥북", "맥북 m4", "macbook m4", "m4 macbook", "m4세대", "m4 칩",
  "m3 max", "m3max", "m3맥스",
  "intel", "인텔", "i5", "i7", "i9",
  // Air / 13"/15"/16" 격리
  "맥북에어", "macbook air", "맥북 에어",
  "13인치", "13형", "13\"", "13in", "15인치", "15형", "15\"", "15in", "16인치", "16형", "16\"", "16in",
  // 다른 Mac 라인업
  "imac", "아이맥", "mac mini", "맥미니", "mac studio", "맥스튜디오",
  // 타 브랜드 노트북
  "lg 그램", "lg그램", "삼성 갤럭시 북", "갤럭시북", "갤럭시 북", "msi", "asus", "레노버", "hp 노트북",
  // 단품/액세서리
  "매직마우스만", "매직키보드만", "모니터만",
  // 다른 용량/RAM 격리 (M3 Pro 18GB 512GB narrow lane)
  "1tb", "1테라", "2tb",
  "36gb", "36 gb", "48gb", "64gb", "96gb",
  "16gb", "16 gb",
  "24gb", "24 gb",
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
  console.log(`existing MacBook Pro 14 M3 18 512 pids: ${skipPids.size}`);

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
    // require MBP + M3 + 14
    const hasMbPro = (norm.includes("맥북") && norm.includes("프로")) || (norm.includes("macbook") && norm.includes("pro")) || norm.includes("맥북프로");
    const hasM3 = norm.includes("m3");
    const has14 = norm.includes("14인치") || norm.includes("14형") || /\b14\b/.test(item.name.toLowerCase()) || norm.includes("14macbook") || norm.includes("macbook14") || norm.includes("14맥북") || norm.includes("맥북14");
    if (!(hasMbPro && hasM3 && has14)) continue;
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
    if (!parsed.comparableKey || !parsed.comparableKey.startsWith("macbook|")) {
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
      query: `wave25_laptop_macbook_pro_14_m3_18_512_boost:${TARGET.skuId}`, source: "bunjang",
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
      raw_json: { source: "wave25_laptop_macbook_pro_14_m3_18_512_boost", lane: TARGET.skuId },
    });
    parsedRows.push(toParsedListingRow(cand.pid, parsed));
  }

  if (applyMode && rawRows.length > 0) {
    if (process.env.WAVE25_WRITE_APPROVED !== "1") throw new Error("Apply refused: set WAVE25_WRITE_APPROVED=1");
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
    category: "wave25_laptop_macbook_pro_14_m3_18_512_boost",
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
  const jsonPath = path.join(reportsDir, "wave21-macbook-pro-14-m3-18-512-boost-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  console.log(`wave25 macbook pro 14 m3 18 512: collected=${items.size}, validated=${validated.length}, applied=${applyMode ? rawRows.length : 0}, expectedKeys=${[...expectedKeys].join(",")}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
