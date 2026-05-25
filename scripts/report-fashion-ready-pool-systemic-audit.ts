import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { evaluatePoolGate } from "@/lib/candidate-pool-builder";
import { ruleMatch, skuById, type Sku } from "@/lib/catalog";
import { CATEGORY_READINESS, LANE_READINESS } from "@/lib/category-readiness";
import { parseListingOptions } from "@/lib/option-parser";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const FASHION_CATEGORIES = new Set(["shoe", "clothing", "bag"]);

type PoolRow = {
  pid: number;
  status: string | null;
  category: string | null;
  comparable_key: string | null;
  expected_profit_min: number | null;
  expected_profit_max: number | null;
  profit_band: number | null;
  last_verified_at: string | null;
};

type RawRow = {
  pid: number;
  sku_id: string | null;
  sku_name: string | null;
  name: string | null;
  price: number | null;
  description_preview: string | null;
  bunjang_condition_label: string | null;
  sale_status: string | null;
};

type ParsedRow = {
  pid: number;
  parser_version: string | null;
  comparable_key: string | null;
  parse_confidence: number | null;
  needs_review: boolean | null;
  parsed_json: Record<string, unknown> | null;
};

type RowAudit = {
  pid: number;
  status: string | null;
  poolCategory: string | null;
  title: string | null;
  price: number | null;
  rawSkuId: string | null;
  currentSkuId: string | null;
  currentBrand: string | null;
  poolKey: string | null;
  parsedKey: string | null;
  currentKey: string | null;
  gateReason: string;
  canEnterPool: boolean;
  textBrandSignals: string[];
  allowedBrandSignals: string[];
  unexpectedBrandSignals: string[];
  flags: string[];
};

type GroupAudit = {
  comparableKey: string;
  poolRows: number;
  sampleRows: number;
  currentSkuIds: string[];
  rawSkuIds: string[];
  unexpectedBrandSignals: string[];
  priceP10: number | null;
  priceP50: number | null;
  priceP90: number | null;
  priceSpreadP90P10: number | null;
  flags: string[];
  samples: Array<{
    pid: number;
    title: string | null;
    price: number | null;
    rawSkuId: string | null;
    currentSkuId: string | null;
    unexpectedBrandSignals: string[];
  }>;
};

const BRAND_SIGNALS: Record<string, RegExp[]> = {
  acne: [/\bacne\b/i, /아크네/],
  adidas: [/\badidas\b/i, /아디다스/],
  arcteryx: [/\barc'?teryx\b/i, /아크테릭스/],
  asics: [/\basics\b/i, /아식스/],
  bape: [/\bbape\b/i, /a bathing ape/i, /베이프/, /에이프/],
  carhartt: [/\bcarhartt\b/i, /칼하트/],
  cdg: [/comme des garcons/i, /\bcdg\b/i, /꼼데/],
  converse: [/\bconverse\b/i, /컨버스/],
  crocs: [/\bcrocs\b/i, /크록스/],
  drmartens: [/dr\.?\s?martens/i, /닥터마틴/],
  fog: [/\bfog\b/i, /fear of god/i, /피오갓/, /피어오브갓/, /피오지/],
  hoka: [/\bhoka\b/i, /호카/],
  marni: [/\bmarni\b/i, /마르니/],
  moncler: [/\bmoncler\b/i, /몽클레/],
  newbalance: [/new\s?balance/i, /\bnb\b/i, /뉴발란스/, /뉴발/],
  nike: [/\bnike\b/i, /나이키/],
  patagonia: [/\bpatagonia\b/i, /파타고니아/],
  polo: [/ralph\s?lauren/i, /\bpolo\b/i, /\brrl\b/i, /랄프로렌/, /폴로/, /더블알엘/],
  puma: [/\bpuma\b/i, /푸마/],
  salomon: [/\bsalomon\b/i, /살로몬/],
  stoneisland: [/stone\s?island/i, /스톤아일랜드/],
  stussy: [/\bstussy\b/i, /스투시/],
  supreme: [/\bsupreme\b/i, /슈프림/],
  thombrowne: [/thom\s?browne/i, /톰브라운/],
  tnf: [/the\s?north\s?face/i, /\btnf\b/i, /노스페이스/],
  ugg: [/\bugg\b/i, /어그/],
  vans: [/\bvans\b/i, /반스/],
  walesbonner: [/wales\s?bonner/i, /웨일스\s?보너/],
};

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      process.env[key] ??= value;
    }
  } catch {
    // Optional local env file.
  }
}

function arg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...await Promise.all(items.slice(i, i + limit).map(worker)));
  }
  return out;
}

function inList(nums: number[]) {
  return `(${nums.join(",")})`;
}

function inc(map: Record<string, number>, key: string | null | undefined) {
  const k = key || "(null)";
  map[k] = (map[k] ?? 0) + 1;
}

async function fetchJson<T>(url: string): Promise<T[]> {
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as T[];
}

function uniq<T>(values: T[]) {
  return [...new Set(values)];
}

function percentile(values: number[], p: number) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[index] ?? null;
}

function brandSignalsIn(text: string) {
  return Object.entries(BRAND_SIGNALS)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(text)))
    .map(([brand]) => brand);
}

function allowedBrandSignals(sku: Sku | null) {
  if (!sku) return [];
  const metaText = [
    sku.id,
    sku.brand,
    sku.modelName,
    sku.laneKey ?? "",
    ...(sku.aliases ?? []),
  ].join(" ");
  return brandSignalsIn(metaText);
}

function currentSkuFor(raw: RawRow | undefined) {
  if (!raw) return null;
  return ruleMatch(raw.name ?? "", raw.description_preview ?? "") ?? null;
}

function parseCurrentSafe(raw: RawRow | undefined, sku: Sku | null) {
  if (!raw || !sku) return null;
  return parseListingOptions({
    title: raw.name ?? "",
    description: raw.description_preview ?? "",
    skuId: sku.id,
    skuName: sku.modelName,
    category: sku.category,
    bunjangConditionLabel: raw.bunjang_condition_label,
    defaultProductType: sku.defaultProductType ?? null,
  });
}

function categoryConflictFlags(category: string | null | undefined, text: string) {
  let t = text.toLowerCase();
  t = t
    .replace(/벨트백|belt bag|웨이스트백|waist bag|힙색|슬링백|slingback/g, " ")
    .replace(/보관\s*가방|더스트백|dust bag|슈즈백|shoe bag|신발\s*주머니/g, " ")
    .replace(/(?:스니커즈|로퍼|부츠).{0,24}(?:매치|코디|어디에도)/g, " ")
    .replace(/더플\s*자켓|더플\s*재킷|duffle\s*(?:coat|jacket)/g, " ");
  const flags: string[] = [];
  const clothing = /트랙팬츠|바지|팬츠|자켓|재킷|패딩|코트|후드|맨투맨|티셔츠|반팔|롱슬리브|셔츠|쇼츠|청바지|데님|니트|가디건|모자|볼캡|벨트|pants|jacket|hoodie|shirt|shorts|denim|jeans|cap|belt/.test(t);
  const shoe = /운동화|스니커|스니커즈|부츠(?!컷)|샌들|슬리퍼|로퍼|슈즈|러닝화|등산화|트레킹화|축구화|풋살화|sneaker|shoe|shoes|\bboot\b|sandal|loafer|slipper/.test(t);
  const bag = /가방|백팩|토트|숄더|크로스백|메신저|더플|클러치|파우치|지갑|월렛|\bbag\b|\bbackpack\b|\btote\b|\bwallet\b|\bpouch\b/.test(t);
  if (category === "shoe" && clothing && !shoe) flags.push("shoe_row_has_clothing_terms");
  if (category === "shoe" && bag && !shoe) flags.push("shoe_row_has_bag_terms");
  if (category === "clothing" && shoe) flags.push("clothing_row_has_shoe_terms");
  if (category === "clothing" && bag) flags.push("clothing_row_has_bag_terms");
  if (category === "bag" && shoe) flags.push("bag_row_has_shoe_terms");
  if (category === "bag" && clothing) flags.push("bag_row_has_clothing_terms");
  return flags;
}

async function fetchRawRows(pids: number[]) {
  const rows: RawRow[] = [];
  for (const part of chunk(uniq(pids), 200)) {
    rows.push(...await fetchJson<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sku_name,name,price,description_preview,bunjang_condition_label,sale_status&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

async function fetchParsedRows(pids: number[]) {
  const rows: ParsedRow[] = [];
  for (const part of chunk(uniq(pids), 200)) {
    rows.push(...await fetchJson<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=pid,parser_version,comparable_key,parse_confidence,needs_review,parsed_json&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

async function fetchComparableGroup(key: string, limit: number) {
  const parsed = await fetchJson<ParsedRow>(
    `${tableUrl("mvp_listing_parsed")}?select=pid,parser_version,comparable_key,parse_confidence,needs_review,parsed_json&comparable_key=eq.${encodeURIComponent(key)}&needs_review=eq.false&parse_confidence=gte.0.65&limit=${limit}`,
  );
  const raw = await fetchRawRows(parsed.map((row) => Number(row.pid)));
  const rawByPid = new Map(raw.map((row) => [Number(row.pid), row]));
  return parsed.map((item) => ({ parsed: item, raw: rawByPid.get(Number(item.pid)) }));
}

function auditPoolRow(pool: PoolRow, raw: RawRow | undefined, parsed: ParsedRow | undefined): RowAudit {
  const currentSku = currentSkuFor(raw);
  const currentParsed = parseCurrentSafe(raw, currentSku);
  const gate = evaluatePoolGate(
    { sku: currentSku, category: currentSku?.category ?? pool.category as Sku["category"] | null },
    { categoryReadiness: CATEGORY_READINESS, laneReadiness: LANE_READINESS },
  );
  const storedSku = raw?.sku_id ? skuById(raw.sku_id) ?? null : null;
  const text = `${raw?.name ?? ""}\n${raw?.description_preview ?? ""}`;
  const textBrands = brandSignalsIn(raw?.name ?? "");
  const allowedBrands = allowedBrandSignals(currentSku);
  const unexpectedBrands = textBrands.filter((brand) => !allowedBrands.includes(brand));
  const flags = [
    ...(raw ? [] : ["missing_raw_row"]),
    ...(gate.canEnterPool ? [] : [`gate_blocked:${gate.reason}`]),
    ...(raw?.sku_id && currentSku?.id !== raw.sku_id ? [`raw_sku_now_${currentSku?.id ?? "null"}`] : []),
    ...(pool.category && currentSku?.category && pool.category !== currentSku.category ? [`pool_category_now_${currentSku.category}`] : []),
    ...(pool.comparable_key && currentParsed?.comparableKey && pool.comparable_key !== currentParsed.comparableKey ? ["pool_key_differs_current_key"] : []),
    ...(parsed?.comparable_key && currentParsed?.comparableKey && parsed.comparable_key !== currentParsed.comparableKey ? ["parsed_key_drift"] : []),
    ...(storedSku && currentSku && storedSku.category !== currentSku.category ? ["stored_current_category_drift"] : []),
    ...(unexpectedBrands.length > 0 ? [`unexpected_brand_signal:${unexpectedBrands.join("+")}`] : []),
    ...categoryConflictFlags(currentSku?.category ?? pool.category, text),
  ];
  return {
    pid: Number(pool.pid),
    status: pool.status,
    poolCategory: pool.category,
    title: raw?.name ?? null,
    price: raw?.price ?? null,
    rawSkuId: raw?.sku_id ?? null,
    currentSkuId: currentSku?.id ?? null,
    currentBrand: currentSku?.brand ?? null,
    poolKey: pool.comparable_key,
    parsedKey: parsed?.comparable_key ?? null,
    currentKey: currentParsed?.comparableKey ?? null,
    gateReason: gate.reason,
    canEnterPool: gate.canEnterPool,
    textBrandSignals: textBrands,
    allowedBrandSignals: allowedBrands,
    unexpectedBrandSignals: unexpectedBrands,
    flags,
  };
}

async function auditComparableGroup(key: string, poolRows: RowAudit[], sampleLimit: number): Promise<GroupAudit> {
  const rows = await fetchComparableGroup(key, sampleLimit);
  const sample = rows.map(({ raw }) => {
    const current = currentSkuFor(raw);
    const unexpectedBrands = brandSignalsIn(raw?.name ?? "").filter((brand) => !allowedBrandSignals(current).includes(brand));
    return {
      raw,
      current,
      unexpectedBrands,
    };
  });
  const prices = sample.map((item) => Number(item.raw?.price ?? NaN)).filter((price) => Number.isFinite(price) && price > 0);
  const p10 = percentile(prices, 0.1);
  const p50 = percentile(prices, 0.5);
  const p90 = percentile(prices, 0.9);
  const currentSkuIds = uniq(sample.map((item) => item.current?.id ?? "null"));
  const rawSkuIds = uniq(sample.map((item) => item.raw?.sku_id ?? "null"));
  const unexpectedBrandSignals = uniq(sample.flatMap((item) => item.unexpectedBrands));
  const poolCurrentSkuIds = uniq(poolRows.map((row) => row.currentSkuId ?? "null"));
  const flags = [
    ...(currentSkuIds.length > 1 ? ["sample_group_mixed_current_sku"] : []),
    ...(rawSkuIds.length > 1 ? ["sample_group_mixed_raw_sku"] : []),
    ...(unexpectedBrandSignals.length > 0 ? [`sample_group_unexpected_brand:${unexpectedBrandSignals.join("+")}`] : []),
    ...(poolCurrentSkuIds.length > 1 ? ["pool_rows_mixed_current_sku"] : []),
    ...(p10 && p90 && p90 / Math.max(1, p10) >= 3 ? ["sample_group_price_spread_ge_3x"] : []),
    ...(sample.some((item) => !item.current) ? ["sample_group_current_catalog_rejects_some"] : []),
  ];
  return {
    comparableKey: key,
    poolRows: poolRows.length,
    sampleRows: sample.length,
    currentSkuIds,
    rawSkuIds,
    unexpectedBrandSignals,
    priceP10: p10,
    priceP50: p50,
    priceP90: p90,
    priceSpreadP90P10: p10 && p90 ? Number((p90 / Math.max(1, p10)).toFixed(2)) : null,
    flags,
    samples: sample.slice(0, 12).map((item) => ({
      pid: Number(item.raw?.pid ?? 0),
      title: item.raw?.name ?? null,
      price: item.raw?.price ?? null,
      rawSkuId: item.raw?.sku_id ?? null,
      currentSkuId: item.current?.id ?? null,
      unexpectedBrandSignals: item.unexpectedBrands,
    })),
  };
}

function actionableRowFlags(flags: string[]) {
  return flags.filter((flag) =>
    !flag.startsWith("raw_sku_now_") &&
    flag !== "pool_key_differs_current_key" &&
    flag !== "parsed_key_drift"
  );
}

function actionableGroupFlags(flags: string[]) {
  return flags.filter((flag) =>
    flag !== "sample_group_mixed_raw_sku" &&
    flag !== "sample_group_price_spread_ge_3x"
  );
}

function markdown(report: {
  generatedAt: string;
  totals: Record<string, number>;
  rowFlags: Record<string, number>;
  groupFlags: Record<string, number>;
  rowSamples: RowAudit[];
  groupSamples: GroupAudit[];
}) {
  const lines = [
    "# Fashion Ready Pool Systemic Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Totals",
    ...Object.entries(report.totals).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Row Flags",
    ...Object.entries(report.rowFlags).sort((a, b) => b[1] - a[1]).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Group Flags",
    ...Object.entries(report.groupFlags).sort((a, b) => b[1] - a[1]).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Actionable Row Samples",
    ...report.rowSamples.slice(0, 40).map((row) => `- pid ${row.pid}: ${row.title} / raw=${row.rawSkuId} / current=${row.currentSkuId} / key=${row.poolKey} / flags=${actionableRowFlags(row.flags).join(",")}`),
    "",
    "## Actionable Group Samples",
    ...report.groupSamples.slice(0, 20).flatMap((group) => [
      `### ${group.comparableKey}`,
      `- poolRows=${group.poolRows}, sampleRows=${group.sampleRows}, currentSkuIds=${group.currentSkuIds.join(",")}, rawSkuIds=${group.rawSkuIds.join(",")}, spread=${group.priceSpreadP90P10 ?? "n/a"}, flags=${actionableGroupFlags(group.flags).join(",")}`,
      ...group.samples.slice(0, 6).map((sample) => `- pid ${sample.pid}: ${sample.title} / raw=${sample.rawSkuId} / current=${sample.currentSkuId} / brandFlags=${sample.unexpectedBrandSignals.join("+")}`),
      "",
    ]),
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const categories = arg("categories", "shoe,clothing,bag").split(",").map((item) => item.trim()).filter((item) => FASHION_CATEGORIES.has(item));
  const statuses = arg("statuses", "ready,reserved").split(",").map((item) => item.trim()).filter(Boolean);
  const samplePerKey = Number(arg("sample-per-key", "40"));
  const groupConcurrency = Number(arg("group-concurrency", "8"));
  const maxGroups = Number(arg("max-groups", "9999"));
  const onlyKeys = arg("only-keys", "").split(";;").map((item) => item.trim()).filter(Boolean);

  const poolRows = await fetchJson<PoolRow>(
    `${tableUrl("mvp_candidate_pool")}?select=pid,status,category,comparable_key,expected_profit_min,expected_profit_max,profit_band,last_verified_at&category=in.(${categories.join(",")})&status=in.(${statuses.join(",")})&order=expected_profit_min.desc&limit=5000`,
  );
  const rawRows = await fetchRawRows(poolRows.map((row) => Number(row.pid)));
  const parsedRows = await fetchParsedRows(poolRows.map((row) => Number(row.pid)));
  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));
  const rowAudits = poolRows.map((row) => auditPoolRow(row, rawByPid.get(Number(row.pid)), parsedByPid.get(Number(row.pid))));
  const rowFlags: Record<string, number> = {};
  for (const row of rowAudits) for (const flag of row.flags) inc(rowFlags, flag);

  const rowsByKey = new Map<string, RowAudit[]>();
  for (const row of rowAudits) {
    if (!row.poolKey) continue;
    const rows = rowsByKey.get(row.poolKey) ?? [];
    rows.push(row);
    rowsByKey.set(row.poolKey, rows);
  }

  const groupEntries = (onlyKeys.length > 0
    ? onlyKeys.map((key) => [key, rowsByKey.get(key) ?? []] as [string, RowAudit[]])
    : [...rowsByKey.entries()]
  ).slice(0, maxGroups);
  console.error(`[systemic-audit] poolRows=${rowAudits.length} groups=${groupEntries.length} samplePerKey=${samplePerKey}`);
  const groupAudits = await mapLimit(groupEntries, groupConcurrency, async ([key, rows]) => auditComparableGroup(key, rows, samplePerKey));
  const groupFlags: Record<string, number> = {};
  for (const group of groupAudits) for (const flag of group.flags) inc(groupFlags, flag);

  const rowActionable = rowAudits.filter((row) => actionableRowFlags(row.flags).length > 0);
  const groupActionable = groupAudits.filter((group) => actionableGroupFlags(group.flags).length > 0);
  const report = {
    generatedAt: new Date().toISOString(),
    scope: { categories, statuses, samplePerKey, groupConcurrency, maxGroups, onlyKeys },
    totals: {
      activePoolRows: rowAudits.length,
      rowFlaggedRows: rowAudits.filter((row) => row.flags.length > 0).length,
      rowActionableRows: rowActionable.length,
      comparableGroups: groupAudits.length,
      groupFlaggedGroups: groupAudits.filter((group) => group.flags.length > 0).length,
      groupActionableGroups: groupActionable.length,
    },
    rowFlags: Object.fromEntries(Object.entries(rowFlags).sort((a, b) => b[1] - a[1])),
    groupFlags: Object.fromEntries(Object.entries(groupFlags).sort((a, b) => b[1] - a[1])),
    rowActionableSamples: rowActionable.slice(0, 100),
    groupActionableSamples: groupActionable
      .sort((a, b) => actionableGroupFlags(b.flags).length - actionableGroupFlags(a.flags).length)
      .slice(0, 80),
    rowAudits,
    groupAudits,
  };

  const jsonPath = path.join(reportsDir, "fashion-ready-pool-systemic-audit-latest.json");
  const mdPath = path.join(reportsDir, "fashion-ready-pool-systemic-audit-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, markdown({
    generatedAt: report.generatedAt,
    totals: report.totals,
    rowFlags: report.rowFlags,
    groupFlags: report.groupFlags,
    rowSamples: report.rowActionableSamples,
    groupSamples: report.groupActionableSamples,
  }));

  console.log(JSON.stringify({
    jsonPath,
    mdPath,
    totals: report.totals,
    topRowFlags: Object.entries(report.rowFlags).slice(0, 12),
    topGroupFlags: Object.entries(report.groupFlags).slice(0, 12),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
