/**
 * mine-narrow-lane.ts
 *
 * Narrow lane miner. Self-contained: collects Bunjang listings for a single
 * lane, applies positive accept rules and negative reject rules, persists
 * samples + parse_ready stats under `category-intelligence/<lane_key>/`.
 *
 * Run:
 *   node --experimental-strip-types scripts/lib/mine-narrow-lane.ts --lane=ipad_pro_11_m4_256_wifi
 *   node --experimental-strip-types scripts/lib/mine-narrow-lane.ts --lane=sony_wh1000xm4 --pages=6
 *   node --experimental-strip-types scripts/lib/mine-narrow-lane.ts --lane=iphone_15_pro_64gb_self
 *
 * Does NOT mine broad categories. One lane per invocation.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "..", "..");
const outBase = path.join(appDir, "category-intelligence");

type LaneKey =
  | "ipad_pro_11_m4_256_wifi"
  | "sony_wh1000xm4"
  | "iphone_15_pro_128gb_self";

type RejectRule = { label: string; pattern: RegExp };

type LaneConfig = {
  laneKey: LaneKey;
  category: string;
  queries: string[];
  pages: number;
  targetParseReady: number;
  priceMin: number;
  priceMax: number;
  acceptAll: RegExp[];
  acceptAnyOf: RegExp[][];
  reject: RegExp[];
  rejectLabelled: RejectRule[];
};

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
  Origin: "https://m.bunjang.co.kr",
  Referer: "https://m.bunjang.co.kr/",
};

// ─── Lane configs ─────────────────────────────────────────────────────────────

const LANES: Record<LaneKey, LaneConfig> = {
  ipad_pro_11_m4_256_wifi: {
    laneKey: "ipad_pro_11_m4_256_wifi",
    category: "tablet",
    queries: [
      "아이패드 프로 11 m4 256",
      "아이패드 프로 m4 256 와이파이",
      "ipad pro 11 m4 256",
      "아이패드 m4 11인치 256",
      "ipad pro m4 256 wifi",
      "아이패드 프로 m4 256",
      "ipad pro m4 256gb",
    ],
    pages: 6,
    targetParseReady: 200,
    priceMin: 700_000,
    priceMax: 2_500_000,
    acceptAll: [/m4/i, /256/, /아이패드|ipad/i],
    acceptAnyOf: [],
    reject: [],
    rejectLabelled: [
      { label: "wrong_chip_m1_m2_m3", pattern: /\bm[123]\b|m1\s*칩|m2\s*칩|m3\s*칩/i },
      { label: "wrong_storage_512_1tb_2tb", pattern: /512\s*(?:gb|기가)?|1\s*tb|2\s*tb|1\s*테라|2\s*테라/i },
      { label: "wrong_storage_128", pattern: /(?:^|[^0-9])128\s*(?:gb|기가)?\b/i },
      { label: "wrong_size_13_inch", pattern: /13\s*인치|12\.9\s*인치|13"|13″/ },
      { label: "cellular_variant", pattern: /셀룰러|cellular|\blte\b|\b5g\b|유심|sim\s*트레이|esim/i },
      { label: "accessory_only", pattern: /케이스\s*(?:만|단품|개별)|필름\s*(?:만|단품)|키보드\s*만|펜슬\s*만|어댑터\s*만|충전기\s*만/i },
      { label: "case_or_smart_folio_listing", pattern: /(?:스마트\s*폴리오|스마트\s*커버|폴리오\s*케이스).{0,8}판매|매직\s*키보드\s*판매/i },
      { label: "broken_or_parts_only", pattern: /액정\s*파손|부품\s*용|부품용|파손\s*품/i },
      { label: "buying_post", pattern: /매입|삽니다|구매\s*합니다|구매합니다|사요|구해요/ },
      { label: "ipad_air_or_mini", pattern: /아이패드\s*에어|ipad\s*air|아이패드\s*미니|ipad\s*mini/i },
      { label: "wrong_model_year_m2_2022", pattern: /2022\s*년|아이패드\s*프로\s*6세대|6세대\s*프로/i },
    ],
  },

  sony_wh1000xm4: {
    laneKey: "sony_wh1000xm4",
    category: "headphone",
    queries: [
      "wh-1000xm4",
      "wh1000xm4",
      "소니 1000xm4",
      "sony xm4",
      "소니 xm4",
      "1000xm4",
    ],
    pages: 5,
    targetParseReady: 200,
    priceMin: 90_000,
    priceMax: 450_000,
    acceptAll: [],
    acceptAnyOf: [[/1000\s*xm4|wh\s*-?\s*1000\s*xm4|\bxm4\b/i]],
    reject: [],
    rejectLabelled: [
      { label: "wrong_gen_xm3", pattern: /1000\s*xm3|wh\s*-?\s*1000\s*xm3|\bxm3\b/i },
      { label: "wrong_gen_xm5", pattern: /1000\s*xm5|wh\s*-?\s*1000\s*xm5|\bxm5\b/i },
      { label: "wrong_gen_xm6", pattern: /1000\s*xm6|\bxm6\b/i },
      { label: "case_only", pattern: /케이스\s*(?:만|단품|개별)|하드\s*케이스\s*만|파우치\s*만|보관\s*케이스\s*만/ },
      { label: "earpad_only", pattern: /이어\s*패드(?:\s*만|\s*교체|\s*단품)?|패드\s*교체용|쿠션\s*교체|패드만\s*판매/ },
      { label: "charger_or_cable_only", pattern: /충전기\s*만|케이블\s*만|usb\s*케이블\s*만|어댑터\s*만/i },
      { label: "parts_only", pattern: /부품\s*용|부품용|파트\s*만|리퍼\s*부품|단자\s*만|힌지\s*부품/ },
      { label: "buying_post", pattern: /매입|삽니다|구해요|구매\s*합니다|구매합니다/ },
      { label: "wrong_product_neckband", pattern: /넥밴드|wi\s*-?\s*c\d{3}|sp\s*510/i },
      { label: "wrong_product_earbuds", pattern: /무선\s*이어폰|이어버드|wf\s*-?\s*1000|linkbuds/i },
      { label: "non_sony_clone", pattern: /짝퉁|가품|복제품|레플리카/ },
      { label: "broken", pattern: /고장|불량\s*품|파손\s*품|작동\s*안\s*됨|소리\s*안\s*나/ },
    ],
  },

  iphone_15_pro_128gb_self: {
    laneKey: "iphone_15_pro_128gb_self",
    category: "smartphone",
    queries: [
      "아이폰 15 프로 128",
      "아이폰15프로 128",
      "iphone 15 pro 128",
      "iphone 15 pro 128 자급제",
      "아이폰 15 pro 128 자급제",
      "아이폰 15 pro 자급제",
      "아이폰 15 프로 블랙티타늄",
      "아이폰 15 프로 화이트티타늄",
      "아이폰 15 프로 블루티타늄",
      "아이폰 15 프로 내추럴티타늄",
      "아이폰 15 프로 128gb",
      "아이폰15프로 128gb",
    ],
    pages: 6,
    targetParseReady: 200,
    priceMin: 600_000,
    priceMax: 1_700_000,
    acceptAll: [/아이폰\s*15\s*프로|iphone\s*15\s*pro/i],
    acceptAnyOf: [],
    reject: [],
    rejectLabelled: [
      { label: "wrong_model_pro_max", pattern: /프로\s*맥스|promax|pro\s*max|프맥/i },
      { label: "wrong_model_15_base_or_plus", pattern: /아이폰\s*15\s*플러스|iphone\s*15\s*plus|아이폰\s*15\s*기본/i },
      { label: "wrong_model_14", pattern: /아이폰\s*14|iphone\s*14/i },
      { label: "wrong_model_16", pattern: /아이폰\s*16|iphone\s*16/i },
      { label: "wrong_storage_64", pattern: /(?:^|[^0-9])64\s*(?:gb|기가)\b/i },
      { label: "wrong_storage_256", pattern: /(?:^|[^0-9])256\s*(?:gb|기가)?\b/i },
      { label: "wrong_storage_512_1tb", pattern: /512\s*(?:gb|기가)?|1\s*tb|1\s*테라/i },
      { label: "carrier_skt", pattern: /\bskt\b|sk\s*텔레콤|에스케이\s*텔레콤/ },
      { label: "carrier_kt", pattern: /(?:^|\s)kt\s*(?:완납|개통|약정|이동|번호|요금|승계|유심)|케이티\s*개통|kt\s*전용/i },
      { label: "carrier_lg", pattern: /\blgu\+?|\blg\s*u\+?|유플\s*러스|엘지\s*유플|엘지유플|lg\s*전용/i },
      { label: "carrier_locked_generic", pattern: /통신사\s*(?:개통|이동|전용|확정)|번호\s*이동|약정\s*(?:승계|진행|걸|남)|선택\s*약정|공시\s*지원|완납\s*폰|완납폰|제휴\s*카드|할부\s*승계|할부\s*원금|할부\s*잔여|개통\s*후|확정\s*기변|확정기변/ },
      { label: "broken_or_parts", pattern: /액정\s*파손|부품\s*용|부품용|파손\s*품|침수|배터리\s*교체\s*요망/ },
      { label: "buying_post", pattern: /매입|삽니다|구해요|구매\s*합니다|구매합니다/ },
      { label: "refurbished_only", pattern: /리퍼\s*폰|리퍼폰|리퍼\s*제품|리퍼\s*수령/ },
      { label: "accessory_only", pattern: /케이스\s*(?:만|단품)|필름\s*(?:만|단품)|충전기\s*만|보호\s*필름\s*만/ },
    ],
  },
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function argValue(name: string, fallback?: string): string | undefined {
  for (const arg of process.argv) {
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function normalize(text: string): string {
  return (text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/[^0-9a-z가-힣./\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Bunjang API ──────────────────────────────────────────────────────────────

type SearchHit = {
  pid: string;
  name: string;
  price: number;
  numFaved: number;
  query: string;
};

async function searchPage(query: string, page: number): Promise<SearchHit[]> {
  const url = new URL("https://api.bunjang.co.kr/api/1/find_v2.json");
  url.searchParams.set("q", query);
  url.searchParams.set("order", "score");
  url.searchParams.set("page", String(page));
  url.searchParams.set("n", "40");
  url.searchParams.set("stat_device", "w");
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return [];
  const data = (await res.json()) as { list?: unknown[] };
  return (data.list ?? [])
    .map((raw): SearchHit | null => {
      const item = raw as Record<string, unknown>;
      const pid = String(item.pid ?? "");
      if (!pid) return null;
      return {
        pid,
        name: String(item.name ?? ""),
        price: toInt(item.price),
        numFaved: toInt(item.num_faved),
        query,
      };
    })
    .filter((x): x is SearchHit => x !== null);
}

type Detail = {
  description: string;
  condition: string;
  saleStatus: string;
  isProshop: boolean;
  salesCount: number;
  reviewRating: number | null;
  reviewCount: number;
};

async function fetchDetail(pid: string): Promise<Detail | null> {
  const url = `https://api.bunjang.co.kr/api/pms/v1/products/${pid}/detail/web`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: { product?: Record<string, unknown>; shop?: Record<string, unknown> };
  };
  const product = json?.data?.product ?? {};
  const shop = json?.data?.shop ?? {};
  return {
    description: String(product.description ?? "").slice(0, 1200),
    condition: String(product.condition ?? ""),
    saleStatus: String(product.saleStatus ?? ""),
    isProshop: shop.proshop === true || shop.isOfficialSeller === true,
    salesCount: toInt(shop.salesCount),
    reviewRating: shop.reviewRating == null ? null : Number(shop.reviewRating),
    reviewCount: toInt(shop.reviewCount),
  };
}

// ─── Filter ──────────────────────────────────────────────────────────────────

type Sample = SearchHit & Detail;

type FilterResult =
  | { parseReady: true; reasons: [] }
  | { parseReady: false; reasons: string[] };

function evaluateLane(config: LaneConfig, sample: Sample): FilterResult {
  const text = normalize(`${sample.name}\n${sample.description}`);
  const reasons: string[] = [];

  if (sample.price > 0) {
    if (sample.price < config.priceMin) reasons.push("price_too_low");
    if (sample.price > config.priceMax) reasons.push("price_too_high");
  }

  for (const pattern of config.acceptAll) {
    if (!pattern.test(text)) reasons.push(`missing_${patternLabel(pattern)}`);
  }

  for (const group of config.acceptAnyOf) {
    if (!group.some((pattern) => pattern.test(text))) {
      reasons.push(`missing_any_${group.map(patternLabel).join("_or_")}`);
    }
  }

  for (const rule of config.rejectLabelled) {
    if (rule.pattern.test(text)) reasons.push(`reject_${rule.label}`);
  }

  return reasons.length === 0
    ? { parseReady: true, reasons: [] }
    : { parseReady: false, reasons };
}

function patternLabel(pattern: RegExp): string {
  return pattern.source.slice(0, 24).replace(/[^a-z0-9가-힣]+/gi, "_");
}

// ─── Collection ──────────────────────────────────────────────────────────────

async function collectCandidates(config: LaneConfig): Promise<SearchHit[]> {
  const byPid = new Map<string, SearchHit>();
  for (const query of config.queries) {
    for (let page = 0; page < config.pages; page++) {
      const items = await searchPage(query, page);
      for (const item of items) {
        if (!byPid.has(item.pid)) byPid.set(item.pid, item);
      }
      await sleep(150);
      if (items.length === 0) break;
    }
    process.stdout.write(`  query "${query}" → cumulative ${byPid.size} unique pids\n`);
  }
  return [...byPid.values()];
}

async function fetchAllDetails(
  hits: SearchHit[],
  onProgress: (done: number, total: number, ready: number) => void,
  config: LaneConfig,
): Promise<{ samples: Sample[]; evaluations: { sample: Sample; result: FilterResult }[] }> {
  const samples: Sample[] = [];
  const evaluations: { sample: Sample; result: FilterResult }[] = [];
  let readyCount = 0;
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    const detail = await fetchDetail(hit.pid);
    await sleep(180);
    if (!detail) continue;
    const sample: Sample = { ...hit, ...detail };
    const result = evaluateLane(config, sample);
    samples.push(sample);
    evaluations.push({ sample, result });
    if (result.parseReady) readyCount++;
    if ((i + 1) % 25 === 0) onProgress(i + 1, hits.length, readyCount);
    if (readyCount >= config.targetParseReady && i >= 220) break;
  }
  return { samples, evaluations };
}

// ─── Output ──────────────────────────────────────────────────────────────────

type RejectStats = { reason: string; count: number };

function tallyRejects(
  evaluations: { sample: Sample; result: FilterResult }[],
): RejectStats[] {
  const counts = new Map<string, number>();
  for (const { result } of evaluations) {
    if (result.parseReady) continue;
    for (const reason of result.reasons) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

async function writeLaneOutputs(
  config: LaneConfig,
  evaluations: { sample: Sample; result: FilterResult }[],
  generatedAt: string,
): Promise<{ parseReady: number; rejected: number; total: number }> {
  const laneDir = path.join(outBase, config.laneKey);
  await mkdir(laneDir, { recursive: true });

  const passed = evaluations.filter((e) => e.result.parseReady);
  const rejected = evaluations.filter((e) => !e.result.parseReady);

  const samples = evaluations.map((e) => ({
    pid: e.sample.pid,
    name: e.sample.name,
    price: e.sample.price,
    num_faved: e.sample.numFaved,
    query: e.sample.query,
    description: e.sample.description,
    condition: e.sample.condition,
    sale_status: e.sample.saleStatus,
    is_proshop: e.sample.isProshop,
    sales_count: e.sample.salesCount,
    review_rating: e.sample.reviewRating,
    review_count: e.sample.reviewCount,
    parse_ready: e.result.parseReady,
    reject_reasons: e.result.parseReady ? [] : e.result.reasons,
  }));

  await writeFile(path.join(laneDir, "samples.json"), JSON.stringify(samples, null, 2));

  const rejectStats = tallyRejects(evaluations);
  const summary = {
    version: 1,
    lane_key: config.laneKey,
    category: config.category,
    generated_at: generatedAt,
    method: "mine-narrow-lane-v1",
    queries: config.queries,
    pages: config.pages,
    price_range_krw: [config.priceMin, config.priceMax],
    target_parse_ready: config.targetParseReady,
    total_fetched: evaluations.length,
    parse_ready_count: passed.length,
    rejected_count: rejected.length,
    target_reached: passed.length >= config.targetParseReady,
    reject_breakdown: rejectStats,
    accept_rules: {
      accept_all: config.acceptAll.map((p) => p.source),
      accept_any_of: config.acceptAnyOf.map((group) => group.map((p) => p.source)),
    },
    reject_rules: config.rejectLabelled.map((r) => ({ label: r.label, pattern: r.pattern.source })),
  };
  await writeFile(path.join(laneDir, "parse_summary.json"), JSON.stringify(summary, null, 2));

  const rejectedSamples = rejected.map((e) => ({
    pid: e.sample.pid,
    name: e.sample.name,
    price: e.sample.price,
    reject_reasons: e.result.reasons,
  }));
  await writeFile(path.join(laneDir, "rejected.json"), JSON.stringify(rejectedSamples, null, 2));

  const readySamples = passed.slice(0, config.targetParseReady).map((e) => ({
    pid: e.sample.pid,
    name: e.sample.name,
    price: e.sample.price,
    query: e.sample.query,
  }));
  await writeFile(path.join(laneDir, "parse_ready_sample.json"), JSON.stringify(readySamples, null, 2));

  const laneConfigDoc = {
    lane_key: config.laneKey,
    category: config.category,
    queries: config.queries,
    accept_all: config.acceptAll.map((p) => p.source),
    accept_any_of: config.acceptAnyOf.map((group) => group.map((p) => p.source)),
    reject_rules: config.rejectLabelled.map((r) => ({ label: r.label, pattern: r.pattern.source })),
    price_min_krw: config.priceMin,
    price_max_krw: config.priceMax,
  };
  await writeFile(path.join(laneDir, "lane_config.json"), JSON.stringify(laneConfigDoc, null, 2));

  return {
    parseReady: passed.length,
    rejected: rejected.length,
    total: evaluations.length,
  };
}

// ─── Entry ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const laneArg = argValue("--lane") as LaneKey | undefined;
  if (!laneArg || !LANES[laneArg]) {
    console.error("usage: mine-narrow-lane.ts --lane=<key>");
    console.error("available lanes:", Object.keys(LANES).join(", "));
    process.exit(1);
  }
  const config = LANES[laneArg];
  const pagesOverride = argValue("--pages");
  if (pagesOverride) config.pages = Number(pagesOverride);

  const generatedAt = new Date().toISOString();
  console.log(`[${config.laneKey}] mining narrow lane`);
  console.log(`  queries (${config.queries.length}): ${config.queries.join(" | ")}`);
  console.log(`  pages: ${config.pages}, target parse_ready: ${config.targetParseReady}`);

  const hits = await collectCandidates(config);
  console.log(`[${config.laneKey}] candidates: ${hits.length}`);

  const { evaluations } = await fetchAllDetails(
    hits,
    (done, total, ready) =>
      console.log(`  detail ${done}/${total} (parse_ready=${ready})`),
    config,
  );

  const stats = await writeLaneOutputs(config, evaluations, generatedAt);
  console.log(
    `[${config.laneKey}] done. total=${stats.total} parse_ready=${stats.parseReady} rejected=${stats.rejected}`,
  );
  if (stats.parseReady < config.targetParseReady) {
    console.warn(
      `  ⚠ parse_ready (${stats.parseReady}) below target (${config.targetParseReady}). Increase --pages or widen queries.`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export { LANES, evaluateLane };
export type { LaneKey, LaneConfig, Sample };
