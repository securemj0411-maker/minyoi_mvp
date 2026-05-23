// Wave 759 v3 (2026-05-24): 골프 클럽 번개장터 API 빠른 fetch.
//
// v2 stuck 원인 분석: ruleMatch 매물마다 1000+ SKU 검사 (46M iterations) → CPU 100% busy loop.
// v3: ruleMatch 제거. 단순 fetch + brand/type 추출만. catalog 매칭은 fetch 후 별도 단계.
//   - Progress log 매 query
//   - Incremental save (10 queries마다)
//   - Single query timeout 8초

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchPage, type SearchItem } from "@/lib/bunjang";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

const GOLF_BRANDS = [
  "캘러웨이", "타이틀리스트", "테일러메이드", "PXG", "핑", "마제스티",
  "혼마", "미즈노 골프", "스릭슨", "브리지스톤 골프", "젝시오", "오노프",
  "스코티 카메론", "오디세이", "코브라 골프",
];
const GOLF_PRODUCT_TYPES = ["드라이버", "아이언", "우드", "퍼터", "웨지", "하이브리드", "클럽 세트"];
const GENERIC_QUERIES = [
  "골프 드라이버", "골프 아이언", "골프 우드", "골프 퍼터", "골프 웨지",
  "골프 클럽 세트", "골프 하이브리드", "골프 풀세트", "골프 클럽",
];

type Record = {
  pid: string;
  name: string;
  price: number;
  query: string;
  brand: string | null;
  productType: string | null;
};

function log(msg: string) {
  process.stderr.write(`[${new Date().toISOString().slice(11, 19)}] ${msg}\n`);
}

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
  if (/요넥스|yonex/.test(t)) return "Yonex";
  if (/포틴|fourteen/.test(t)) return "Fourteen";
  if (/엔진|engine/.test(t) && /골프|퍼터/.test(t)) return "Engine";
  if (/prgr|프로기어/.test(t)) return "PRGR";
  if (/^핑\s|핑\s+골프|\sping\s/.test(t)) return "Ping";
  if (/아담스|adams/.test(t)) return "Adams";
  if (/클리블랜드|cleveland/.test(t)) return "Cleveland";
  if (/벤호건|ben\s*hogan|fourteen/.test(t)) return "Ben Hogan";
  if (/세인트앤드류|stx/.test(t)) return "St Andrews";
  if (/포브스|forbes/.test(t)) return "Forbes";
  if (/유티/.test(t) && /골프/.test(t)) return "Yuti";
  if (/볼빅|volvik/.test(t)) return "Volvik";
  return null;
}

function extractProductType(title: string): string | null {
  const t = title.toLowerCase();
  if (/드라이버|driver|1번우드/.test(t)) return "driver";
  if (/아이언/.test(t) && !/우드|드라이버|퍼터|웨지|하이브리드/.test(t)) return "iron";
  if (/페어웨이\s*우드|fairway\s*wood|5번우드|3번우드/.test(t)) return "fairway_wood";
  if (/하이브리드|hybrid|유틸리티|utility/.test(t)) return "hybrid";
  if (/퍼터|putter/.test(t)) return "putter";
  if (/웨지|wedge|sw\b|pw\b|gw\b|aw\b/.test(t)) return "wedge";
  if (/클럽\s*세트|full\s*set|풀세트|풀\s*세트|하프\s*세트|half\s*set/.test(t)) return "set";
  if (/우드/.test(t)) return "wood_other";
  if (/샤프트|shaft/.test(t)) return "shaft";
  return null;
}

const records: Record[] = [];
let queriesDone = 0;
let apiCalls = 0;
let apiErrors = 0;
const outDir = path.join(appDir, "docs/AUDIT_LOG");
mkdirSync(outDir, { recursive: true });
const startTs = Date.now();
const partialPath = path.join(outDir, `wave759-golf-club-sweep-${startTs}-partial.json`);
const finalPath = path.join(outDir, `wave759-golf-club-sweep-${startTs}.json`);

function saveReport(isPartial = false) {
  const dedupe = new Map<string, Record>();
  for (const r of records) dedupe.set(r.pid, r);
  const unique = Array.from(dedupe.values());

  const byBrand = new Map<string, number>();
  const byType = new Map<string, number>();
  const byPriceTier = new Map<string, number>();
  const samplesByBrand = new Map<string, Record[]>();

  for (const r of unique) {
    const b = r.brand ?? "unknown";
    const pt = r.productType ?? "unknown";
    byBrand.set(b, (byBrand.get(b) ?? 0) + 1);
    byType.set(pt, (byType.get(pt) ?? 0) + 1);
    const tier = r.price < 100000 ? "<10만" : r.price < 300000 ? "10~30만" : r.price < 800000 ? "30~80만" : r.price < 2000000 ? "80~200만" : "200만+";
    byPriceTier.set(tier, (byPriceTier.get(tier) ?? 0) + 1);
    const list = samplesByBrand.get(b) ?? [];
    if (list.length < 8) list.push(r);
    samplesByBrand.set(b, list);
  }

  const report = {
    sweep: "wave759-golf-club",
    isPartial,
    timestamp: new Date().toISOString(),
    queriesDone, apiCalls, apiErrors,
    elapsedSec: Math.round((Date.now() - startTs) / 1000),
    totalFetched: records.length,
    uniqueMatters: unique.length,
    byBrand: Object.fromEntries([...byBrand.entries()].sort((a, b) => b[1] - a[1])),
    byType: Object.fromEntries([...byType.entries()].sort((a, b) => b[1] - a[1])),
    byPriceTier: Object.fromEntries([...byPriceTier.entries()].sort((a, b) => b[1] - a[1])),
    samplesByBrand: Object.fromEntries(
      [...samplesByBrand.entries()].sort((a, b) => (byBrand.get(b[0]) ?? 0) - (byBrand.get(a[0]) ?? 0)).map(([b, list]) => [
        b,
        list.map((r) => `[${r.price.toLocaleString()}] ${r.name}`),
      ]),
    ),
  };

  writeFileSync(isPartial ? partialPath : finalPath, JSON.stringify(report, null, 2));
  log(`SAVED ${isPartial ? "partial" : "final"}: ${unique.length} unique matters`);
}

process.on("SIGTERM", () => { log("SIGTERM"); saveReport(true); process.exit(143); });
process.on("SIGINT", () => { log("SIGINT"); saveReport(true); process.exit(130); });

async function fetchWithTimeout(query: string, page: number): Promise<SearchItem[]> {
  const tStart = Date.now();
  try {
    const items = await Promise.race([
      searchPage(query, page, { order: "score", limit: 96 }),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("timeout_8s")), 8_000),
      ),
    ]);
    return items;
  } catch (e) {
    apiErrors += 1;
    log(`  ERR ${query} p${page}: ${(e as Error).message}`);
    return [];
  }
}

async function runSweep() {
  const queries = [
    ...GENERIC_QUERIES,
    ...GOLF_BRANDS.flatMap((brand) =>
      GOLF_PRODUCT_TYPES.map((pt) => `${brand} ${pt}`),
    ),
  ];

  log(`START: ${queries.length} queries × 2 pages`);

  for (let qi = 0; qi < queries.length; qi++) {
    const query = queries[qi];
    for (let page = 0; page < 2; page++) {
      apiCalls += 1;
      const items = await fetchWithTimeout(query, page);
      for (const item of items) {
        records.push({
          pid: item.pid,
          name: item.name,
          price: item.price,
          query,
          brand: extractBrand(item.name),
          productType: extractProductType(item.name),
        });
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    queriesDone += 1;
    if ((qi + 1) % 5 === 0) {
      log(`PROGRESS ${qi + 1}/${queries.length} | ${records.length} fetched | ${apiErrors} errs`);
    }
    if ((qi + 1) % 15 === 0) {
      saveReport(true);
    }
  }

  saveReport(false);
  log(`DONE: ${records.length} fetched, ${Math.round((Date.now() - startTs) / 1000)}s elapsed`);
}

runSweep().catch((e) => {
  log(`FATAL: ${(e as Error).message}`);
  saveReport(true);
  process.exit(1);
});
