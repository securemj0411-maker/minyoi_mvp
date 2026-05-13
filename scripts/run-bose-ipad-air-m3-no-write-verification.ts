import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { fetchDetail, searchPage, type SearchItem } from "../src/lib/bunjang";
import { ruleMatch } from "../src/lib/catalog";
import { parseListingOptions } from "../src/lib/option-parser";
import { classifyListing } from "../src/lib/pipeline";
import { detectSoldOut, isSoldOut } from "../src/lib/sold-out";

type LaneSpec = {
  id: string;
  expectedSkuId: string;
  queries: string[];
  searchLimitPerQuery: number;
  detailCap: number;
  detailReasons: (title: string, description: string, skuId: string | null) => string[];
};

const lanes: LaneSpec[] = [
  {
    id: "bose_qc_ultra",
    expectedSkuId: "bose-qc-ultra-headphones",
    queries: [
      "보스 qc 울트라 헤드폰",
      "bose quietcomfort ultra",
      "보스 quietcomfort 울트라",
      "보스 qcultra",
      "qc 울트라 헤드폰",
    ],
    searchLimitPerQuery: 25,
    detailCap: 30,
    detailReasons: (title, description, skuId) => {
      const t = `${title}\n${description}`.toLowerCase();
      const titleN = title.toLowerCase();
      const reasons: string[] = [];
      if (!/(보스|bose)/i.test(t)) reasons.push("missing_bose_context");
      if (!/(quietcomfort\s*ultra|qc\s*ultra|qc\s*울트라|qcultra|quietcomfort\s*울트라)/i.test(t)) {
        reasons.push("missing_qc_ultra_context");
      }
      if (!/(헤드폰|헤드셋|headphones?)/i.test(t)) reasons.push("missing_headphone_context");
      if (/(이어버드|earbuds?|qc\s*이어|qc\s*earbuds?|이어\s*폰)/i.test(titleN)) {
        reasons.push("qc_earbuds_wrong_model");
      }
      if (/(qc\s*45|qc45|quietcomfort\s*45|qc\s*35|qc\s*25|qc\s*15|nc\s*700|nc700|noise\s*cancelling\s*700)/i.test(titleN)) {
        reasons.push("non_ultra_qc_model");
      }
      if (/(이어\s*쿠션|이어쿠션|이어\s*패드|이어패드|헤드\s*밴드|헤드밴드|케이스\s*만|파우치\s*만|충전\s*케이블\s*만|보호\s*필름\s*만|스킨\s*만|스티커\s*만)/i.test(t)) {
        reasons.push("accessory_or_parts_only");
      }
      if (/(케이스|커버|파우치|스킨)/i.test(titleN) && /(만\s*판매|단품|만\s*드림)/i.test(t)) {
        reasons.push("accessory_only_title");
      }
      if (/(삽니다|매입|구합니다|구매합니다|구매원함)/i.test(t)) reasons.push("buying_signal");
      if (/(가품|레플|이미테이션|짝퉁|호환|비정품|모조)/i.test(t)) reasons.push("fake_signal");
      if (/(고장|파손|수리|침수|전원\s*안|충전\s*안|소리\s*안|한쪽\s*안|노캔\s*안|불량|부품용)/i.test(t)) {
        reasons.push("damaged_or_parts_signal");
      }
      if (skuId && skuId !== "bose-qc-ultra-headphones") reasons.push(`wrong_sku:${skuId}`);
      return [...new Set(reasons)];
    },
  },
  {
    id: "ipad_air_m3_11_256_wifi",
    expectedSkuId: "ipad-air-m3-11-256-wifi",
    queries: [
      "아이패드 에어 m3 11 256 wifi",
      "ipad air m3 11 256 wifi",
      "아이패드 에어 11 m3 256",
      "ipad air 11 m3 256",
      "아이패드 에어 m3 256 와이파이",
    ],
    searchLimitPerQuery: 25,
    detailCap: 30,
    detailReasons: (title, description, skuId) => {
      const t = `${title}\n${description}`.toLowerCase();
      const titleN = title.toLowerCase();
      const reasons: string[] = [];
      if (!/(아이패드|ipad)/i.test(t)) reasons.push("missing_ipad_context");
      if (!/(에어|air)/i.test(t)) reasons.push("missing_air_context");
      if (!/m3/i.test(t)) reasons.push("missing_m3_context");
      if (!/(256\s*(gb|기가|g)?)/i.test(t)) reasons.push("missing_256_context");
      if (!/(11\s*인치|11\s*형|11"|11″|11''|11인)/i.test(t)) reasons.push("missing_11in_context");
      if (!/(wifi|wi[-\s]?fi|와이파이|와이\s*파이|wi-fi)/i.test(t)) {
        reasons.push("missing_wifi_context_silent_cellular_risk");
      }
      if (/(셀룰러|cellular|lte|5g(?!hz)|sim|유심|esim)/i.test(t)) reasons.push("cellular_signal_wrong_sku");
      if (/(프로\b|\bpro\b|미니\b|\bmini\b)/i.test(titleN)) reasons.push("non_air_model_signal");
      if (/\b(m1|m2|m4|m5)\b/i.test(titleN)) reasons.push("non_m3_generation_signal");
      if (/(13\s*인치|13"|13형|12\.9|12,9|10\.9|10,9|10\.2|10\.5|9\.7)/i.test(titleN)) {
        reasons.push("non_11in_size_signal");
      }
      if (/(64\s*gb|128\s*gb|512\s*gb|1\s*tb|1tb|2\s*tb|2tb)/i.test(titleN)) {
        reasons.push("non_256_capacity_signal");
      }
      if (/(케이스|커버|폴리오|키보드|펜슬|apple\s*pencil|스마트\s*키보드|매직\s*키보드|매직키보드)/i.test(titleN)) {
        reasons.push("bundle_or_accessory_title_signal");
      }
      if (/(케이스\s*만|커버\s*만|파우치\s*만|폴리오\s*만|펜슬\s*만|키보드\s*만)/i.test(t)) {
        reasons.push("accessory_only");
      }
      if (/(삽니다|매입|구합니다|구매합니다)/i.test(t)) reasons.push("buying_signal");
      if (/(가품|레플|이미테이션|짝퉁|비정품)/i.test(t)) reasons.push("fake_signal");
      if (/(고장|파손|수리|침수|불량|부품용|액정\s*깨|화면\s*깨)/i.test(t)) reasons.push("damaged_or_parts_signal");
      if (skuId && skuId !== "ipad-air-m3-11-256-wifi") reasons.push(`wrong_sku:${skuId}`);
      return [...new Set(reasons)];
    },
  },
];

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function searchLane(lane: LaneSpec) {
  const collected = new Map<string, SearchItem>();
  for (const q of lane.queries) {
    await sleep(180);
    try {
      const items = await searchPage(q, 0, { order: "date", limit: lane.searchLimitPerQuery });
      for (const it of items) {
        if (!collected.has(it.pid)) collected.set(it.pid, it);
      }
    } catch (err) {
      console.warn(`[${lane.id}] search "${q}" failed:`, err instanceof Error ? err.message : err);
    }
  }
  return [...collected.values()];
}

function classifySearchRow(item: SearchItem) {
  const description = typeof item.raw?.description === "string" ? (item.raw.description as string) : "";
  const { listingType, sku } = classifyListing(item.name, description, item.price);
  const finalSku = sku ?? ruleMatch(item.name, description);
  const parsed = parseListingOptions({
    title: item.name,
    description,
    category: finalSku?.category ?? null,
    skuId: finalSku?.id ?? null,
    skuName: finalSku?.modelName ?? null,
  });
  const searchReasons: string[] = [];
  if (listingType !== "normal") searchReasons.push(`listing_type_${listingType}`);
  if (!finalSku) searchReasons.push("no_sku_match");
  if (!parsed.comparableKey) searchReasons.push("missing_comparable_key");
  const decision: "clean" | "hold" = searchReasons.length === 0 ? "clean" : "hold";
  return { item, listingType, sku: finalSku, parsed, decision, searchReasons };
}

type Classified = ReturnType<typeof classifySearchRow>;

async function verifyDetail(row: Classified, lane: LaneSpec) {
  await sleep(150);
  let detail = null;
  try {
    detail = await fetchDetail(row.item.pid);
  } catch (err) {
    console.warn(`[${lane.id}] detail ${row.item.pid} fetch error:`, err instanceof Error ? err.message : err);
  }
  if (!detail) {
    return { ...row, detail: null, detailReasons: ["detail_fetch_failed"], sold: false, soldSignals: [] as ReturnType<typeof detectSoldOut> };
  }
  const description = detail.description ?? "";
  const reClassified = classifyListing(row.item.name, description, row.item.price);
  const skuId = reClassified.sku?.id ?? row.sku?.id ?? null;
  const reasons = lane.detailReasons(row.item.name, description, skuId);
  if (reClassified.listingType !== "normal") reasons.push(`detail_listing_type_${reClassified.listingType}`);
  const soldSignals = detectSoldOut(detail, row.item.price, { title: row.item.name });
  const sold = isSoldOut(soldSignals);
  return { ...row, detail, detailReasons: [...new Set(reasons)], sold, soldSignals };
}

type Verified = Awaited<ReturnType<typeof verifyDetail>>;

function buildSummary(lane: LaneSpec, items: SearchItem[], classified: Classified[], verified: Verified[]) {
  const cleanCandidates = classified.filter((c) => c.decision === "clean");
  const activeClean = verified.filter((v) => !v.sold && v.detailReasons.length === 0).length;
  const sold = verified.filter((v) => v.sold).length;
  const review = verified.filter((v) => !v.sold && v.detailReasons.length > 0).length;
  const detailFetchFailed = verified.filter((v) => v.detail === null).length;

  const reasonCount = new Map<string, number>();
  for (const v of verified) {
    if (v.sold) continue;
    for (const r of v.detailReasons) reasonCount.set(r, (reasonCount.get(r) ?? 0) + 1);
  }
  const reasonHist = [...reasonCount.entries()].sort((a, b) => b[1] - a[1]);

  const sellerCount = new Map<string, number>();
  for (const v of verified) {
    const uid = v.detail?.shopUid ?? null;
    if (!uid) continue;
    sellerCount.set(uid, (sellerCount.get(uid) ?? 0) + 1);
  }
  const sellerOverlap = [...sellerCount.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1]);

  const proshopCount = verified.filter((v) => v.detail?.shopProshop || v.detail?.shopOfficialSeller).length;

  const prices = verified.filter((v) => !v.sold).map((v) => v.item.price).filter((p) => p > 0).sort((a, b) => a - b);
  const median = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;
  const min = prices[0] ?? 0;
  const max = prices[prices.length - 1] ?? 0;

  return {
    lane: lane.id,
    expectedSkuId: lane.expectedSkuId,
    generatedAt: new Date().toISOString(),
    mode: "no_write_live_verification",
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    candidatePoolPatch: false,
    catalogPatch: false,
    queries: lane.queries,
    search: {
      uniqueItems: items.length,
      cleanCandidates: cleanCandidates.length,
      hold: classified.length - cleanCandidates.length,
    },
    detail: {
      fetched: verified.length,
      fetchFailed: detailFetchFailed,
      activeClean,
      sold,
      review,
    },
    reasonHistogram: Object.fromEntries(reasonHist),
    sellerOverlap: sellerOverlap.map(([uid, count]) => ({ shopUid: uid, count })),
    proshopOrOfficialCount: proshopCount,
    priceStats: { count: prices.length, min, median, max },
    rows: verified.map((v) => ({
      pid: v.item.pid,
      title: v.item.name,
      price: v.item.price,
      skuId: v.sku?.id ?? null,
      comparableKey: v.parsed.comparableKey,
      listingType: v.listingType,
      searchReasons: v.searchReasons,
      sold: v.sold,
      detailReasons: v.detailReasons,
      shopUid: v.detail?.shopUid ?? null,
      shopProshop: v.detail?.shopProshop ?? false,
      saleStatus: v.detail?.saleStatus ?? null,
      descPreview: (v.detail?.description ?? "").slice(0, 240),
    })),
  };
}

function statusLabel(v: Verified) {
  if (v.detail === null) return "❓ detail_fail";
  if (v.sold) return "❌ sold";
  if (v.detailReasons.length === 0) return "✅ clean";
  return "⚠️ review";
}

function buildMarkdown(summary: ReturnType<typeof buildSummary>, verified: Verified[]) {
  const reasonRows = Object.entries(summary.reasonHistogram).map(([r, c]) => `| ${r} | ${c} |`).join("\n");
  const sellerRows = summary.sellerOverlap.length === 0
    ? "- 없음 (동일 shopUid 중복 0)"
    : "| shopUid | count |\n| --- | ---: |\n" + summary.sellerOverlap.map((s) => `| ${s.shopUid} | ${s.count} |`).join("\n");
  const rowsMd = verified.map((v) => {
    const status = statusLabel(v);
    const reasons = v.detailReasons.join(", ") || "-";
    const title = v.item.name.length > 50 ? `${v.item.name.slice(0, 50)}…` : v.item.name;
    return `| ${v.item.pid} | ${status} | ${v.item.price.toLocaleString()} | ${v.parsed.comparableKey ?? "-"} | ${reasons} | ${title} |`;
  }).join("\n");

  return `# ${summary.lane} — no-write live verification

- generatedAt: ${summary.generatedAt}
- mode: ${summary.mode}
- DB mutation / candidate-pool / public / catalog: false / false / false / false
- expected SKU: \`${summary.expectedSkuId}\`

## Queries (${summary.queries.length})

${summary.queries.map((q) => `- \`${q}\``).join("\n")}

## Counts

| metric | value |
| --- | ---: |
| unique items fetched | ${summary.search.uniqueItems} |
| search clean candidates | ${summary.search.cleanCandidates} |
| search hold | ${summary.search.hold} |
| detail fetched | ${summary.detail.fetched} |
| detail fetch failed | ${summary.detail.fetchFailed} |
| **activeClean** | **${summary.detail.activeClean}** |
| sold (detail) | ${summary.detail.sold} |
| review (detail reasons) | ${summary.detail.review} |
| proshop/official seller | ${summary.proshopOrOfficialCount} |

## Detail Reason Histogram

| reason | count |
| --- | ---: |
${reasonRows || "| — | 0 |"}

## Seller Overlap

${sellerRows}

## Price Stats (KRW, active only)

- count: ${summary.priceStats.count}, min: ${summary.priceStats.min.toLocaleString()}, median: ${summary.priceStats.median.toLocaleString()}, max: ${summary.priceStats.max.toLocaleString()}

## Verified Rows

| pid | status | price | comparableKey | reasons | title |
| --- | --- | ---: | --- | --- | --- |
${rowsMd}
`;
}

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports");

async function main() {
  await mkdir(REPORT_DIR, { recursive: true });
  const summaries: ReturnType<typeof buildSummary>[] = [];

  for (const lane of lanes) {
    console.log(`>>> ${lane.id} search start`);
    const items = await searchLane(lane);
    console.log(`  fetched ${items.length} unique items across ${lane.queries.length} queries`);

    const classified = items.map(classifySearchRow);
    const cleanForDetail = classified.filter((c) => c.decision === "clean").slice(0, lane.detailCap);
    console.log(`  search: clean ${cleanForDetail.length}, hold ${classified.length - cleanForDetail.length}`);

    const verified: Verified[] = [];
    for (const row of cleanForDetail) {
      verified.push(await verifyDetail(row, lane));
    }

    const summary = buildSummary(lane, items, classified, verified);
    summaries.push(summary);

    await writeFile(path.join(REPORT_DIR, `${lane.id}-no-write-verification-latest.json`), JSON.stringify(summary, null, 2));
    await writeFile(path.join(REPORT_DIR, `${lane.id}-no-write-verification-latest.md`), buildMarkdown(summary, verified));

    console.log(`  wrote reports/${lane.id}-no-write-verification-latest.{json,md}`);
    console.log(`  activeClean=${summary.detail.activeClean}, sold=${summary.detail.sold}, review=${summary.detail.review}, proshop=${summary.proshopOrOfficialCount}`);
  }

  console.log(JSON.stringify(summaries.map((s) => ({
    lane: s.lane,
    items: s.search.uniqueItems,
    searchClean: s.search.cleanCandidates,
    detailFetched: s.detail.fetched,
    activeClean: s.detail.activeClean,
    sold: s.detail.sold,
    review: s.detail.review,
    proshop: s.proshopOrOfficialCount,
  })), null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
