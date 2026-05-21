import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

type JoongnaPriceKind = "bid" | "sold";

type JoongnaPriceSummary = {
  searchKeyword: string | null;
  empty: boolean;
  points: number;
  lineDays: number;
  weightedMedian: number | null;
  weightedAvg: number | null;
  lastLineAvg: number | null;
  lineAvg: number | null;
  itemCount: number;
  itemMedian: number | null;
  sampleItems: Array<{ title: string | null; price: number | null; seq: number | null }>;
};

type MarketDailyRow = {
  date: string;
  comparable_key: string;
  condition_class: string;
  active_median_price: number | null;
  sold_median_price: number | null;
  blended_median_price: number | null;
  active_sample_count: number | null;
  sold_sample_count: number | null;
  confidence: string | null;
};

type CaseConfig = {
  label: string;
  query: string;
  keys?: string[];
  keyLike?: string;
  note: string;
};

const CASES: CaseConfig[] = [
  {
    label: "Stussy broad",
    query: "스투시",
    keyLike: "stussy",
    note: "브랜드 broad query. 티셔츠/모자/후드/가방이 섞이는지 확인.",
  },
  {
    label: "Stussy hoodie zip",
    query: "스투시 후드집업",
    keys: [
      "clothing|stussy_hoodie|hoodie_zip|a_grade",
      "clothing|stussy_hoodie|hoodie_zip|unknown_condition",
    ],
    note: "사용자 예시처럼 product type을 좁힌 query.",
  },
  {
    label: "Stussy hoodie",
    query: "스투시 후드",
    keys: [
      "clothing|stussy_hoodie|hoodie|unknown_condition",
      "clothing|stussy_hoodie|crewneck|unknown_condition",
    ],
    note: "후드/맨투맨/후드집업 혼합 정도 확인.",
  },
  {
    label: "AirPods Max",
    query: "에어팟 맥스",
    keys: [
      "airpods|airpods_max|usbc",
      "airpods|airpods_max|lightning",
    ],
    note: "부품용/라이트닝/USB-C가 섞이는 대표 케이스.",
  },
  {
    label: "Bose SoundLink Flex",
    query: "보스 사운드링크 플렉스",
    keys: ["speaker|bose_soundlink_flex|portable_bluetooth_speaker"],
    note: "단일 모델에 가까운 저분산 케이스.",
  },
  {
    label: "BenQ XL2540K",
    query: "벤큐 XL2540K",
    keys: ["monitor|xl2540k|24_5in|fhd|240hz|tn|unknown_shape"],
    note: "모델명이 분명한 전자제품 케이스.",
  },
];

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
}

function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function average(values: number[]) {
  const filtered = values.filter(Number.isFinite);
  if (!filtered.length) return null;
  return Math.round(filtered.reduce((sum, value) => sum + value, 0) / filtered.length);
}

function weightedScatterPrices(scatterPrices: Array<{ priceCounts?: Array<{ price?: number; count?: number }> }> = []) {
  const prices: number[] = [];
  for (const hour of scatterPrices) {
    for (const priceCount of hour.priceCounts ?? []) {
      const price = Number(priceCount.price);
      const count = Math.max(1, Math.min(500, Number(priceCount.count ?? 1)));
      if (!Number.isFinite(price)) continue;
      for (let i = 0; i < count; i += 1) prices.push(price);
    }
  }
  return prices;
}

async function fetchJoongnaPriceSummary(searchWord: string, kind: JoongnaPriceKind): Promise<JoongnaPriceSummary> {
  const priceType = kind === "bid" ? 0 : 1;
  const res = await fetch("https://search-api.joongna.com/v4/analysis/product-price/scatter-plot", {
    method: "POST",
    headers: {
      "User-Agent": process.env.JOONGNA_USER_AGENT ?? "MinyoiSourceProbe/0.1 (+contact: operator)",
      Accept: "application/json,text/plain,*/*",
      "Content-Type": "application/json",
      Origin: "https://web.joongna.com",
      Referer: `https://web.joongna.com/search-price/${encodeURIComponent(searchWord)}`,
      "Os-Type": "2",
    },
    body: JSON.stringify({
      searchWord,
      productPriceSize: 20,
      dateRange: 30,
      priceType,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Joongna price API failed ${res.status}: ${text.slice(0, 240)}`);

  const parsed = JSON.parse(text) as {
    data?: {
      searchKeyword?: string;
      emptyResult?: unknown;
      productPrice?: {
        scatterPrices?: Array<{ priceCounts?: Array<{ price?: number; count?: number }> }>;
        linePrices?: Array<{ avgPrice?: number }>;
      };
      items?: Array<{ title?: string; price?: number; seq?: number }>;
    };
  };
  const data = parsed.data ?? {};
  const productPrice = data.productPrice ?? {};
  const scatter = weightedScatterPrices(productPrice.scatterPrices);
  const linePrices = productPrice.linePrices ?? [];
  const lineAvgPrices = linePrices.map((line) => Number(line.avgPrice)).filter(Number.isFinite);
  const items = data.items ?? [];

  return {
    searchKeyword: data.searchKeyword ?? null,
    empty: Boolean(data.emptyResult),
    points: scatter.length,
    lineDays: linePrices.length,
    weightedMedian: median(scatter),
    weightedAvg: average(scatter),
    lastLineAvg: lineAvgPrices.length ? lineAvgPrices[lineAvgPrices.length - 1] : null,
    lineAvg: average(lineAvgPrices),
    itemCount: items.length,
    itemMedian: median(items.map((item) => Number(item.price))),
    sampleItems: items.slice(0, 5).map((item) => ({
      title: item.title ?? null,
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
      seq: Number.isFinite(Number(item.seq)) ? Number(item.seq) : null,
    })),
  };
}

async function fetchMarketDailyRows(config: CaseConfig): Promise<MarketDailyRow[]> {
  const select = "date,comparable_key,condition_class,active_median_price,sold_median_price,blended_median_price,active_sample_count,sold_sample_count,confidence";
  const filter = config.keys?.length
    ? `comparable_key=in.(${config.keys.map(encodeURIComponent).join(",")})`
    : `comparable_key=ilike.*${encodeURIComponent(config.keyLike ?? config.query)}*`;
  const rows = await restFetch(
    `${tableUrl("mvp_market_price_daily")}?select=${select}&${filter}&order=date.desc,computed_at.desc&limit=120`,
    { headers: serviceHeaders() },
  ).then((res) => res.json() as Promise<MarketDailyRow[]>);

  const latest = new Map<string, MarketDailyRow>();
  for (const row of rows) {
    const key = `${row.comparable_key}|${row.condition_class}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  return [...latest.values()].slice(0, 12);
}

function krw(value: number | null) {
  return value == null ? "-" : `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function marketCompact(rows: MarketDailyRow[]) {
  return rows.map((row) => ({
    key: row.comparable_key,
    condition: row.condition_class,
    active: row.active_median_price,
    sold: row.sold_median_price,
    blended: row.blended_median_price,
    samples: `${row.active_sample_count ?? 0}/${row.sold_sample_count ?? 0}`,
    confidence: row.confidence,
  }));
}

async function main() {
  await loadEnvFile(path.join(process.cwd(), ".env.local"));
  await loadEnvFile(path.join(process.cwd(), ".env"));

  const startedAt = new Date().toISOString();
  const cases = [];
  for (const config of CASES) {
    const bid = await fetchJoongnaPriceSummary(config.query, "bid");
    await new Promise((resolve) => setTimeout(resolve, 250));
    const sold = await fetchJoongnaPriceSummary(config.query, "sold");
    await new Promise((resolve) => setTimeout(resolve, 250));
    const ourLatest = await fetchMarketDailyRows(config);
    cases.push({ ...config, joongna: { bid, sold }, ourLatest });
  }

  const report = {
    source: "joongna",
    mode: "price_poc_read_only",
    generatedAt: new Date().toISOString(),
    startedAt,
    decisionHint: "Treat Joongna search-price as an external keyword reference, not as trusted SKU/condition median.",
    cases,
  };

  await mkdir(path.join(process.cwd(), "reports"), { recursive: true });
  await writeFile(
    path.join(process.cwd(), "reports", "joongna-price-poc-latest.json"),
    JSON.stringify(report, null, 2),
  );

  const md = [
    "# Joongna Price PoC",
    "",
    `- generatedAt: ${report.generatedAt}`,
    "- mode: read-only; no database writes",
    "- endpoint: `POST https://search-api.joongna.com/v4/analysis/product-price/scatter-plot`",
    "- priceType: `0 = 등록가`, `1 = 판매가`",
    "",
    "## Summary",
    "",
    "Joongna search-price is useful as an external keyword reference, but it is not a replacement for our SKU + condition market median. Broad queries mix product types, and even narrow queries do not expose condition-class segmentation.",
    "",
    "| Case | Query | JN 등록가 median | JN 판매가 median | JN points bid/sold | Our closest active/blended rows | Note |",
    "| --- | --- | ---: | ---: | ---: | --- | --- |",
    ...cases.map((item) => {
      const rows = item.ourLatest.slice(0, 4).map((row) => {
        const shortKey = row.comparable_key.split("|").slice(1, 3).join("/");
        return `${shortKey}:${row.condition_class} active ${krw(row.active_median_price)} blended ${krw(row.blended_median_price)} (${row.active_sample_count ?? 0}/${row.sold_sample_count ?? 0})`;
      }).join("<br>");
      return `| ${item.label} | ${item.query} | ${krw(item.joongna.bid.weightedMedian)} | ${krw(item.joongna.sold.weightedMedian)} | ${item.joongna.bid.points}/${item.joongna.sold.points} | ${rows || "-"} | ${item.note} |`;
    }),
    "",
    "## Recommendation",
    "",
    "- Keep our SKU + condition median as the primary truth for recommendation/profit.",
    "- Store Joongna search-price as `external_reference` only when the query is narrow and sample count is healthy.",
    "- Do not blend Joongna search-price into trusted median unless the query can be mapped to the same comparable key and condition band with high confidence.",
    "- Use Joongna sold data as a confidence cross-check or warning label: e.g. `중고나라 검색어 기준 참고가와 차이가 큼`, not as the price used for profit.",
    "- For broad fashion terms like Stussy, Joongna is especially risky because product types are mixed. Our parser is likely more useful when the catalog lane is clean.",
    "",
    "## Compact JSON",
    "",
    "```json",
    JSON.stringify(cases.map((item) => ({
      label: item.label,
      query: item.query,
      joongna: item.joongna,
      ourLatest: marketCompact(item.ourLatest),
    })), null, 2),
    "```",
    "",
  ].join("\n");
  await writeFile(path.join(process.cwd(), "reports", "joongna-price-poc-latest.md"), md);

  console.log(JSON.stringify({
    generatedAt: report.generatedAt,
    cases: cases.map((item) => ({
      label: item.label,
      query: item.query,
      joongnaBidMedian: item.joongna.bid.weightedMedian,
      joongnaSoldMedian: item.joongna.sold.weightedMedian,
      joongnaBidPoints: item.joongna.bid.points,
      joongnaSoldPoints: item.joongna.sold.points,
      ourRows: marketCompact(item.ourLatest).slice(0, 4),
    })),
    output: {
      json: "reports/joongna-price-poc-latest.json",
      markdown: "reports/joongna-price-poc-latest.md",
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({
    source: "joongna",
    mode: "price_poc_read_only",
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  }, null, 2));
  process.exitCode = 1;
});
