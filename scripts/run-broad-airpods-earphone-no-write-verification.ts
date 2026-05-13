import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { fetchDetail, searchPage, type SearchItem } from "../src/lib/bunjang";
import { ruleMatch } from "../src/lib/catalog";
import { parseListingOptions } from "../src/lib/option-parser";
import { classifyListing } from "../src/lib/pipeline";
import { detectSoldOut, isSoldOut } from "../src/lib/sold-out";

type LaneSpec = {
  id: string;
  laneKind: "broad_brand" | "broad_category";
  queries: string[];
  searchLimitPerQuery: number;
  detailCap: number;
  acceptedCategory: string;
  acceptedSkuPrefixes?: string[];
  rejectedSkuPrefixes?: string[];
  detailReasons: (title: string, description: string, skuId: string | null, skuCategory: string | null) => string[];
};

function commonHardHoldReasons(title: string, description: string): string[] {
  const t = `${title}\n${description}`.toLowerCase();
  const reasons: string[] = [];
  if (/(케이스\s*만|파우치\s*만|보호\s*필름\s*만|스킨\s*만|이어팁\s*만|보호\s*케이스\s*만|커버\s*만|스트랩\s*만|행거\s*만)/i.test(t)) {
    reasons.push("accessory_only");
  }
  if (/(이어\s*쿠션|이어쿠션|이어\s*패드|이어패드|헤드\s*밴드\s*만|헤드밴드\s*만|이어팁\s*세트)/i.test(t)) {
    reasons.push("replacement_pads_or_band");
  }
  if (/(왼쪽\s*만|오른쪽\s*만|왼쪽\s*유닛|오른쪽\s*유닛|좌\s*만|우\s*만|좌측\s*만|우측\s*만|배터리\s*교체용|부품용|충전\s*케이블\s*만|충전기\s*만|충전\s*케이스\s*만|크래들\s*만)/i.test(t)) {
    reasons.push("parts_only");
  }
  if (/(삽니다|매입|구합니다|구매합니다|구매원함|매입합니다)/i.test(t)) reasons.push("buying_signal");
  if (/(가품|레플|이미테이션|짝퉁|호환|비정품|모조|짝퉁아님|정품아님)/i.test(t)) reasons.push("fake_signal");
  if (/(고장|파손|수리\s*요|침수|불량|부품용|소리\s*안|한쪽\s*안|페어링\s*안|충전\s*안|전원\s*안|배터리\s*수명)/i.test(t)) {
    reasons.push("damaged_signal");
  }
  return reasons;
}

const lanes: LaneSpec[] = [
  {
    id: "airpods_broad",
    laneKind: "broad_brand",
    queries: [
      "에어팟",
      "airpods",
      "에어팟 프로",
      "에어팟 맥스",
      "에어팟 4세대",
    ],
    searchLimitPerQuery: 25,
    detailCap: 40,
    acceptedCategory: "earphone",
    acceptedSkuPrefixes: ["airpods"],
    detailReasons: (title, description, skuId, skuCategory) => {
      const t = `${title}\n${description}`.toLowerCase();
      const titleN = title.toLowerCase();
      const reasons = commonHardHoldReasons(title, description);
      if (!/(에어팟|airpods)/i.test(titleN)) reasons.push("missing_airpods_context_in_title");
      if (skuCategory && skuCategory !== "earphone") reasons.push(`wrong_category:${skuCategory}`);
      if (skuId && !skuId.startsWith("airpods")) reasons.push(`non_airpods_sku:${skuId}`);
      if (/(전용\s*케이스|보호\s*케이스\s*판매|투명\s*케이스)/i.test(titleN) && /(케이스만|단품|만\s*판매)/i.test(t)) {
        reasons.push("accessory_only_title");
      }
      if (/(beats|bose|sony|소니|jbl|마샬|marshall|샤오미|xiaomi|삼성)/i.test(titleN)) {
        reasons.push("non_apple_brand_in_airpods_query");
      }
      return [...new Set(reasons)];
    },
  },
  {
    id: "earphone_discovered_broad",
    laneKind: "broad_category",
    queries: [
      "무선 이어폰",
      "블루투스 이어폰",
      "노이즈캔슬링 이어폰",
      "무선 헤드폰",
      "블루투스 헤드폰",
    ],
    searchLimitPerQuery: 25,
    detailCap: 40,
    acceptedCategory: "earphone",
    rejectedSkuPrefixes: [],
    detailReasons: (title, description, skuId, skuCategory) => {
      const titleN = title.toLowerCase();
      const reasons = commonHardHoldReasons(title, description);
      if (skuCategory && skuCategory !== "earphone") reasons.push(`wrong_category:${skuCategory}`);
      if (!skuId) reasons.push("no_sku_match_broad_unknown_model");
      if (/(스피커|speaker|사운드바|sound\s*bar|블루투스\s*스피커)/i.test(titleN)) {
        reasons.push("non_earphone_speaker_signal");
      }
      if (/(마이크\s*전용|microphone|마이크\s*세트|배송용|행거|거치대\s*전용)/i.test(titleN)) {
        reasons.push("non_earphone_accessory_signal");
      }
      if (/(자동차|차량용|cassette|카세트|구식|아날로그)/i.test(titleN)) {
        reasons.push("non_modern_earphone_signal");
      }
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

function classifySearchRow(item: SearchItem, lane: LaneSpec) {
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
  if (lane.laneKind === "broad_brand") {
    if (!finalSku) searchReasons.push("no_sku_match");
    if (lane.acceptedSkuPrefixes && finalSku && !lane.acceptedSkuPrefixes.some((p) => finalSku.id.startsWith(p))) {
      searchReasons.push(`non_accepted_sku:${finalSku.id}`);
    }
  } else if (lane.laneKind === "broad_category") {
    if (finalSku && finalSku.category !== lane.acceptedCategory) {
      searchReasons.push(`wrong_category:${finalSku.category}`);
    }
  }
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
  const skuCategory = reClassified.sku?.category ?? row.sku?.category ?? null;
  const reasons = lane.detailReasons(row.item.name, description, skuId, skuCategory);
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

  const modelHist = new Map<string, number>();
  for (const v of verified) {
    if (v.sold) continue;
    const skuId = v.sku?.id ?? "unknown_sku";
    modelHist.set(skuId, (modelHist.get(skuId) ?? 0) + 1);
  }
  const modelDistribution = [...modelHist.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([skuId, count]) => ({ skuId, count }));

  const prices = verified.filter((v) => !v.sold).map((v) => v.item.price).filter((p) => p > 0).sort((a, b) => a - b);
  const median = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;
  const min = prices[0] ?? 0;
  const max = prices[prices.length - 1] ?? 0;

  return {
    lane: lane.id,
    laneKind: lane.laneKind,
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
    modelDistribution,
    sellerOverlap: sellerOverlap.map(([uid, count]) => ({ shopUid: uid, count })),
    proshopOrOfficialCount: proshopCount,
    priceStats: { count: prices.length, min, median, max },
    rows: verified.map((v) => ({
      pid: v.item.pid,
      title: v.item.name,
      price: v.item.price,
      skuId: v.sku?.id ?? null,
      skuCategory: v.sku?.category ?? null,
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
  const modelRows = summary.modelDistribution.length === 0
    ? "- 없음"
    : "| skuId | count |\n| --- | ---: |\n" + summary.modelDistribution.map((m) => `| ${m.skuId} | ${m.count} |`).join("\n");
  const rowsMd = verified.map((v) => {
    const status = statusLabel(v);
    const reasons = v.detailReasons.join(", ") || "-";
    const title = v.item.name.length > 50 ? `${v.item.name.slice(0, 50)}…` : v.item.name;
    const sku = v.sku?.id ?? "—";
    return `| ${v.item.pid} | ${status} | ${v.item.price.toLocaleString()} | ${sku} | ${reasons} | ${title} |`;
  }).join("\n");

  return `# ${summary.lane} (${summary.laneKind}) — no-write live verification

- generatedAt: ${summary.generatedAt}
- mode: ${summary.mode}
- DB mutation / candidate-pool / public / catalog: false / false / false / false

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

## SKU Model Distribution (active only)

${modelRows}

## Detail Reason Histogram

| reason | count |
| --- | ---: |
${reasonRows || "| — | 0 |"}

## Seller Overlap

${sellerRows}

## Price Stats (KRW, active only)

- count: ${summary.priceStats.count}, min: ${summary.priceStats.min.toLocaleString()}, median: ${summary.priceStats.median.toLocaleString()}, max: ${summary.priceStats.max.toLocaleString()}

## Verified Rows

| pid | status | price | sku | reasons | title |
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

    const classified = items.map((it) => classifySearchRow(it, lane));
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
    laneKind: s.laneKind,
    items: s.search.uniqueItems,
    searchClean: s.search.cleanCandidates,
    detailFetched: s.detail.fetched,
    activeClean: s.detail.activeClean,
    sold: s.detail.sold,
    review: s.detail.review,
    proshop: s.proshopOrOfficialCount,
    topModels: s.modelDistribution.slice(0, 5),
  })), null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
