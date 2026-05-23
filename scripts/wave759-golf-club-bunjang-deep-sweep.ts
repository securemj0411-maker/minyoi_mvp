// Wave 759 (2026-05-24): 골프 클럽 카테고리 번개장터 API deep sweep.
//
// 사용자 명령: "골프클럽맞지? 그냥 골프말고 골프 클럽도 1만건 sweep 번개장터에서 하고 똑같이"
//
// 목적:
//   - 골프 클럽 (드라이버/아이언/우드/퍼터/웨지/하이브리드/세트) 1만건 fresh fetch
//   - 매물 분포: brand / product type / model code / 일반인 표현 / 한정판
//   - 매칭률: catalog 매칭 % + 미매칭 패턴
//   - Output: JSON report + brand 별 신설 SKU 후보 추출

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchPage, type SearchItem } from "@/lib/bunjang";
import { CATALOG, ruleMatch, type Sku } from "@/lib/catalog";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

// 골프 클럽 검색 query (brand + product type 조합).
// 각 query 0~2 page (96 × 3 = 288건). 30 queries × 288 = ~8K 매물.
const GOLF_BRANDS = [
  "캘러웨이",
  "타이틀리스트",
  "테일러메이드",
  "PXG",
  "핑",
  "마제스티",
  "혼마",
  "미즈노 골프",
  "스릭슨",
  "브리지스톤 골프",
  "젝시오",
  "오노프",
  "스코티 카메론",
  "오디세이",
  "코브라 골프",
];

const GOLF_PRODUCT_TYPES = ["드라이버", "아이언", "우드", "퍼터", "웨지", "하이브리드", "클럽 세트"];

const GENERIC_QUERIES = [
  "골프 드라이버",
  "골프 아이언",
  "골프 우드",
  "골프 퍼터",
  "골프 웨지",
  "골프 클럽 세트",
  "골프 하이브리드",
  "골프 하프 세트",
  "골프 풀세트",
  "골프 클럽",
];

type GolfMatterRecord = {
  pid: string;
  name: string;
  price: number;
  query: string;
  matchedSkuId: string | null;
  matchedBrand: string | null;
  brand: string | null;
  productType: string | null;
  pricetier: string;
};

// title에서 brand 추출 (regex 단순화).
function extractBrand(title: string): string | null {
  const t = title.toLowerCase();
  if (/타이틀리스트|titleist/.test(t)) return "Titleist";
  if (/캘러웨이|callaway/.test(t)) return "Callaway";
  if (/테일러메이드|taylormade/.test(t)) return "TaylorMade";
  if (/pxg/.test(t)) return "PXG";
  if (/마제스티|majesty/.test(t)) return "Majesty";
  if (/혼마|honma/.test(t)) return "Honma";
  if (/스릭슨|srixon/.test(t)) return "Srixon";
  if (/브리지스톤|bridgestone/.test(t)) return "Bridgestone";
  if (/젝시오|xxio/.test(t)) return "XXIO";
  if (/오노프|onoff/.test(t)) return "Onoff";
  if (/스코티\s*카메론|scotty\s*cameron/.test(t)) return "Scotty Cameron";
  if (/오디세이|odyssey/.test(t)) return "Odyssey";
  if (/코브라|cobra/.test(t)) return "Cobra";
  if (/미즈노/.test(t) && /골프|아이언|드라이버|우드|퍼터|웨지/.test(t)) return "Mizuno";
  if (/푸마|puma/.test(t) && /골프/.test(t)) return "Puma Golf";
  if (/나이키|nike/.test(t) && /골프/.test(t)) return "Nike Golf";
  if (/아디다스|adidas/.test(t) && /골프/.test(t)) return "Adidas Golf";
  if (/요넥스|yonex/.test(t)) return "Yonex";
  if (/포틴|fourteen/.test(t)) return "Fourteen";
  if (/페어웨이|fairway/.test(t)) return "Fairway";
  if (/엔진|engine/.test(t) && /골프|퍼터/.test(t)) return "Engine";
  if (/조지|george/.test(t)) return "George Spirits";
  return null;
}

function extractProductType(title: string): string | null {
  const t = title.toLowerCase();
  if (/드라이버|driver|1번우드/.test(t)) return "driver";
  if (/아이언|iron/.test(t) && !/우드|드라이버|퍼터|웨지|하이브리드/.test(t)) return "iron";
  if (/페어웨이\s*우드|fairway\s*wood|5번우드|3번우드/.test(t)) return "fairway_wood";
  if (/하이브리드|hybrid|유틸리티|utility/.test(t)) return "hybrid";
  if (/퍼터|putter/.test(t)) return "putter";
  if (/웨지|wedge|sw\b|pw\b|gw\b|aw\b|lw\b/.test(t)) return "wedge";
  if (/클럽\s*세트|full\s*set|풀세트|풀\s*세트|하프\s*세트|half\s*set/.test(t)) return "set";
  if (/우드/.test(t)) return "wood_other";
  if (/샤프트|shaft/.test(t)) return "shaft";
  return null;
}

function priceTier(price: number): string {
  if (price < 50000) return "<5만";
  if (price < 100000) return "5~10만";
  if (price < 200000) return "10~20만";
  if (price < 500000) return "20~50만";
  if (price < 1000000) return "50만~100만";
  if (price < 2000000) return "100만~200만";
  return "200만+";
}

async function runSweep() {
  const records: GolfMatterRecord[] = [];
  const queries = [
    ...GENERIC_QUERIES,
    ...GOLF_BRANDS.flatMap((brand) =>
      GOLF_PRODUCT_TYPES.map((pt) => `${brand} ${pt}`),
    ),
  ];

  console.log(`Total queries: ${queries.length}`);

  for (let qi = 0; qi < queries.length; qi++) {
    const query = queries[qi];
    for (let page = 0; page < 2; page++) {
      try {
        const items = await searchPage(query, page, { order: "score", limit: 96 });
        for (const item of items) {
          const matched = ruleMatch(item.name, "") as Sku | null;
          const matchedSku = matched ?? null;
          records.push({
            pid: item.pid,
            name: item.name,
            price: item.price,
            query,
            matchedSkuId: matchedSku?.id ?? null,
            matchedBrand: matchedSku?.brand ?? null,
            brand: extractBrand(item.name),
            productType: extractProductType(item.name),
            pricetier: priceTier(item.price),
          });
        }
        await new Promise((r) => setTimeout(r, 300));
      } catch (e) {
        console.warn(`Failed: ${query} page=${page} — ${(e as Error).message}`);
      }
    }
    if ((qi + 1) % 10 === 0) {
      console.log(`Progress: ${qi + 1}/${queries.length} (${records.length} matters)`);
    }
  }

  // 분석.
  const dedupe = new Map<string, GolfMatterRecord>();
  for (const r of records) dedupe.set(r.pid, r);
  const unique = Array.from(dedupe.values());

  const byBrand = new Map<string, number>();
  const byProductType = new Map<string, number>();
  const byMatchedSku = new Map<string, number>();
  const byPriceTier = new Map<string, number>();
  const unmatchedByBrand = new Map<string, GolfMatterRecord[]>();
  const matchedByBrand = new Map<string, GolfMatterRecord[]>();

  for (const r of unique) {
    const b = r.brand ?? "unknown_brand";
    const pt = r.productType ?? "unknown_type";
    byBrand.set(b, (byBrand.get(b) ?? 0) + 1);
    byProductType.set(pt, (byProductType.get(pt) ?? 0) + 1);
    byPriceTier.set(r.pricetier, (byPriceTier.get(r.pricetier) ?? 0) + 1);
    if (r.matchedSkuId) {
      byMatchedSku.set(r.matchedSkuId, (byMatchedSku.get(r.matchedSkuId) ?? 0) + 1);
      const list = matchedByBrand.get(b) ?? [];
      if (list.length < 5) list.push(r);
      matchedByBrand.set(b, list);
    } else {
      const list = unmatchedByBrand.get(b) ?? [];
      if (list.length < 10) list.push(r);
      unmatchedByBrand.set(b, list);
    }
  }

  const total = unique.length;
  const matched = unique.filter((r) => r.matchedSkuId).length;
  const unmatched = total - matched;

  const report = {
    sweep: "wave759-golf-club",
    timestamp: new Date().toISOString(),
    queries: queries.length,
    totalFetched: records.length,
    uniqueMatters: total,
    matchedCount: matched,
    unmatchedCount: unmatched,
    matchRate: ((matched / total) * 100).toFixed(2) + "%",
    byBrand: Object.fromEntries([...byBrand.entries()].sort((a, b) => b[1] - a[1])),
    byProductType: Object.fromEntries([...byProductType.entries()].sort((a, b) => b[1] - a[1])),
    byMatchedSku: Object.fromEntries([...byMatchedSku.entries()].sort((a, b) => b[1] - a[1])),
    byPriceTier: Object.fromEntries([...byPriceTier.entries()].sort((a, b) => b[1] - a[1])),
    unmatchedSamplesByBrand: Object.fromEntries(
      [...unmatchedByBrand.entries()].map(([b, list]) => [
        b,
        list.map((r) => `[${r.price.toLocaleString()}] ${r.name}`),
      ]),
    ),
    matchedSamplesByBrand: Object.fromEntries(
      [...matchedByBrand.entries()].map(([b, list]) => [
        b,
        list.map((r) => `[${r.price.toLocaleString()}] ${r.name} → ${r.matchedSkuId}`),
      ]),
    ),
  };

  const outDir = path.join(appDir, "docs/AUDIT_LOG");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `wave759-golf-club-sweep-${Date.now()}.json`);
  await writeFile(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved: ${outPath}`);
  console.log(`\nSummary:`);
  console.log(`  Total matters: ${total} (${matched} matched, ${unmatched} unmatched, ${report.matchRate})`);
  console.log(`  Top brands:`, Object.fromEntries(Object.entries(report.byBrand).slice(0, 8)));
  console.log(`  Top types:`, report.byProductType);
}

runSweep().catch((e) => {
  console.error(e);
  process.exit(1);
});
