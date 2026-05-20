import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseListingOptions } from "@/lib/option-parser";
import { ruleMatch, skuById, type Sku } from "@/lib/catalog";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");
const decisionDir = path.join(appDir, "docs", "DECISIONS");

type FashionCategory = "shoe" | "clothing" | "bag";

type RawRow = {
  pid: number;
  name: string | null;
  price: number | null;
  query: string | null;
  detail_status: string | null;
  listing_state: string | null;
  listing_type: string | null;
  listing_type_override: string | null;
  sale_status: string | null;
  sku_id: string | null;
  sku_name: string | null;
  description_preview: string | null;
  bunjang_condition_label: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  detail_enriched_at: string | null;
  pool_eligible: boolean | null;
  score_dirty: boolean | null;
};

type ParsedRow = {
  pid: number;
  parser_version: string | null;
  category: FashionCategory | string | null;
  family: string | null;
  model: string | null;
  variant_key: string | null;
  comparable_key: string | null;
  parse_confidence: number | null;
  condition_score: number | null;
  condition_class: string | null;
  condition_notes: string[] | null;
  needs_review: boolean | null;
  parsed_json: Record<string, unknown> | null;
  parsed_at: string | null;
};

type PoolRow = {
  pid: number;
  status: string | null;
  category: string | null;
  comparable_key: string | null;
  profit_band: string | null;
  expected_profit_min: number | null;
  expected_profit_max: number | null;
  last_verified_at: string | null;
};

type SweepCase = {
  pid: number;
  title: string;
  price: number | null;
  query: string | null;
  rawSkuId: string | null;
  rawSkuCategory: string | null;
  currentRuleSkuId: string | null;
  currentRuleCategory: string | null;
  dbCategory: string | null;
  dbKey: string | null;
  rawReparseKey: string | null;
  currentRuleKey: string | null;
  dbParserVersion: string | null;
  dbNeedsReview: boolean | null;
  rawReparseNeedsReview: boolean;
  currentRuleNeedsReview: boolean | null;
  dbConfidence: number | null;
  rawReparseConfidence: number;
  poolStatus: string | null;
  poolProfitBand: string | null;
  mismatchFlags: string[];
  categoryConflictFlags: string[];
  productType: string | null;
  conditionNotesCount: number;
  listingState: string | null;
  lastSeenAt: string | null;
};

const EXPECTED_PARSER_BY_CATEGORY: Record<FashionCategory, string> = {
  shoe: "wave92-shoe-v11",
  clothing: "wave216-clothing-v11",
  bag: "wave92-bag-v10",
};

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
  } catch {
    // Optional local env file.
  }
}

function arg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchJson<T>(url: string): Promise<T[]> {
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as T[];
}

async function fetchAll<T>(baseUrl: string, limit: number, orderBy?: string): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  const ordered = orderBy ? `${baseUrl}&order=${encodeURIComponent(orderBy)}` : baseUrl;
  for (let offset = 0; offset < limit; offset += pageSize) {
    const pageLimit = Math.min(pageSize, limit - offset);
    const sep = ordered.includes("?") ? "&" : "?";
    const page = await fetchJson<T>(`${ordered}${sep}limit=${pageLimit}&offset=${offset}`);
    rows.push(...page);
    if (page.length < pageLimit) break;
  }
  return rows;
}

function rawSelect() {
  return [
    "pid",
    "name",
    "price",
    "query",
    "detail_status",
    "listing_state",
    "listing_type",
    "listing_type_override",
    "sale_status",
    "sku_id",
    "sku_name",
    "description_preview",
    "bunjang_condition_label",
    "first_seen_at",
    "last_seen_at",
    "detail_enriched_at",
    "pool_eligible",
    "score_dirty",
  ].join(",");
}

function parsedSelect() {
  return [
    "pid",
    "parser_version",
    "category",
    "family",
    "model",
    "variant_key",
    "comparable_key",
    "parse_confidence",
    "condition_score",
    "condition_class",
    "condition_notes",
    "needs_review",
    "parsed_json",
    "parsed_at",
  ].join(",");
}

async function fetchRecentFashionSkuRaw(sinceIso: string, limit: number, skuFilterCsv = "") {
  const skuIds = skuFilterCsv.split(",").map((item) => item.trim()).filter(Boolean);
  const filter = skuIds.length > 0
    ? `sku_id=in.(${skuIds.map(encodeURIComponent).join(",")})`
    : "or=(sku_id.like.shoe-%2A,sku_id.like.clothing-%2A,sku_id.like.bag-%2A)";
  const url = `${tableUrl("mvp_raw_listings")}?select=${rawSelect()}&${filter}&detail_status=eq.done&last_seen_at=gte.${encodeURIComponent(sinceIso)}`;
  return fetchAll<RawRow>(url, limit, "last_seen_at.desc");
}

async function fetchRecentNullSkuRaw(sinceIso: string, limit: number) {
  const url = `${tableUrl("mvp_raw_listings")}?select=${rawSelect()}&sku_id=is.null&detail_status=eq.done&last_seen_at=gte.${encodeURIComponent(sinceIso)}`;
  return fetchAll<RawRow>(url, limit, "last_seen_at.desc");
}

async function fetchParsedByPid(pids: number[]) {
  const rows: ParsedRow[] = [];
  for (const part of chunk([...new Set(pids)], 200)) {
    rows.push(...await fetchJson<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=${parsedSelect()}&pid=in.(${part.join(",")})&limit=${part.length}`,
    ));
  }
  return rows;
}

async function fetchPoolByPid(pids: number[]) {
  const rows: PoolRow[] = [];
  const select = "pid,status,category,comparable_key,profit_band,expected_profit_min,expected_profit_max,last_verified_at";
  for (const part of chunk([...new Set(pids)], 200)) {
    rows.push(...await fetchJson<PoolRow>(
      `${tableUrl("mvp_candidate_pool")}?select=${select}&pid=in.(${part.join(",")})&limit=${part.length}`,
    ));
  }
  return rows;
}

function isFashionCategory(category: unknown): category is FashionCategory {
  return category === "shoe" || category === "clothing" || category === "bag";
}

function inc(map: Record<string, number>, key: string | null | undefined, by = 1) {
  map[key || "null"] = (map[key || "null"] ?? 0) + by;
}

function numberPrice(value: number | null | undefined) {
  const n = Number(value ?? NaN);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function median(values: number[]) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  return sorted[Math.floor(sorted.length / 2)];
}

function percentile(values: number[], p: number) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))];
}

function productTypeFromParsedJson(category: string | null | undefined, parsedJson: Record<string, unknown> | null | undefined) {
  if (!parsedJson) return null;
  if (category === "shoe") return typeof parsedJson.shoe_product_type === "string" ? parsedJson.shoe_product_type : null;
  if (category === "clothing") return typeof parsedJson.clothing_product_type === "string" ? parsedJson.clothing_product_type : null;
  if (category === "bag") return typeof parsedJson.bag_product_type === "string" ? parsedJson.bag_product_type : null;
  return null;
}

function fashionKeywordHit(text: string) {
  return /신발|운동화|스니커|스니커즈|부츠|샌들|슬리퍼|로퍼|슈즈|러닝화|등산화|트레킹화|축구화|풋살화|자켓|재킷|패딩|코트|후드|맨투맨|티셔츠|셔츠|바지|팬츠|쇼츠|청바지|데님|니트|가디건|모자|볼캡|벨트|지갑|가방|백팩|토트|숄더|크로스백|파우치|jacket|hoodie|shirt|pants|shorts|sneaker|shoe|boots|sandal|bag|backpack|tote|wallet/i.test(text);
}

function categoryConflictFlags(category: string | null, text: string) {
  let t = text.toLowerCase();
  t = t
    .replace(/벨트백|belt bag|웨이스트백|waist bag|힙색|슬링백|slingback/g, " ")
    .replace(/의류\/잡화|의류 잡화|clothing\/accessor(?:y|ies)/g, " ")
    .replace(/보관\s*가방|더스트백|dust bag|슈즈백|shoe bag|신발\s*주머니/g, " ");
  const flags: string[] = [];
  const clothing = /트랙팬츠|트랙 팬츠|바지|팬츠|자켓|재킷|패딩|코트|후드|맨투맨|티셔츠|반팔|롱슬리브|셔츠|쇼츠|청바지|데님|니트|가디건|모자|볼캡|벨트|pants|jacket|hoodie|shirt|shorts|denim|jeans|cap|belt/.test(t);
  const shoe = /운동화|스니커|스니커즈|부츠|샌들|슬리퍼|로퍼|슈즈|러닝화|등산화|트레킹화|축구화|풋살화|sneaker|shoe|shoes|boot|sandal|loafer|slipper/.test(t);
  const bag = /가방|백팩|토트|숄더|크로스백|메신저|더플|클러치|파우치|지갑|카드지갑|월렛|bag|backpack|tote|shoulder|crossbody|wallet|pouch/.test(t);
  if (category === "shoe" && clothing) flags.push("shoe_row_has_clothing_terms");
  if (category === "shoe" && bag) flags.push("shoe_row_has_bag_terms");
  if (category === "clothing" && shoe) flags.push("clothing_row_has_shoe_terms");
  if (category === "clothing" && bag) flags.push("clothing_row_has_bag_terms");
  if (category === "bag" && shoe) flags.push("bag_row_has_shoe_terms");
  if (category === "bag" && clothing) flags.push("bag_row_has_clothing_terms");
  return flags;
}

function parseWithSku(row: RawRow, sku: Sku | null) {
  if (!sku) return null;
  return parseListingOptions({
    title: row.name ?? "",
    description: row.description_preview ?? "",
    skuId: sku.id,
    skuName: sku.modelName,
    category: sku.category,
    bunjangConditionLabel: row.bunjang_condition_label,
    defaultProductType: sku.defaultProductType ?? null,
  });
}

function makeSweepCase(row: RawRow, parsed: ParsedRow | undefined, pool: PoolRow | undefined): SweepCase {
  const title = row.name ?? "";
  const text = `${title}\n${row.description_preview ?? ""}`;
  const rawSku = row.sku_id ? skuById(row.sku_id) ?? null : null;
  const currentSku = ruleMatch(title, row.description_preview ?? "");
  const rawReparse = parseWithSku(row, rawSku);
  const currentReparse = parseWithSku(row, currentSku);
  const flags: string[] = [];
  const rawCategory = rawSku?.category ?? null;
  const expectedParser = isFashionCategory(rawCategory) ? EXPECTED_PARSER_BY_CATEGORY[rawCategory] : null;
  const dbKey = parsed?.comparable_key ?? null;
  const rawKey = rawReparse?.comparableKey ?? null;
  const currentKey = currentReparse?.comparableKey ?? null;

  if (!parsed) flags.push("missing_parsed_row");
  if (expectedParser && parsed?.parser_version !== expectedParser) flags.push("parsed_stale_version");
  if (row.sku_id && !currentSku) flags.push("raw_sku_rejected_by_current_catalog");
  if (row.sku_id && currentSku && currentSku.id !== row.sku_id) flags.push("raw_sku_differs_from_current_catalog");
  if (dbKey !== rawKey) flags.push("db_key_differs_from_raw_reparse");
  if (currentSku && dbKey !== currentKey) flags.push("db_key_differs_from_current_catalog_reparse");
  if (!currentSku && parsed?.needs_review === false && (parsed.parse_confidence ?? 0) >= 0.65) flags.push("db_clean_but_current_catalog_rejects");
  if (currentSku && currentKey !== dbKey && parsed?.needs_review === false && (parsed.parse_confidence ?? 0) >= 0.65) flags.push("db_clean_but_current_catalog_changes_key");
  if ((pool?.status === "ready" || pool?.status === "reserved") && flags.some((f) => f.includes("current_catalog") || f.includes("stale"))) {
    flags.push("pool_exposed_with_catalog_or_parser_drift");
  }
  if (rawCategory === "shoe" && rawReparse?.parsedJson?.shoe_product_type_from_shoe_default === true) flags.push("shoe_product_type_defaulted_to_sneaker");
  if (rawCategory === "shoe" && rawReparse?.parsedJson?.shoe_size_mm == null) flags.push("shoe_unknown_size");
  if (rawCategory === "shoe" && rawReparse?.parsedJson?.shoe_condition_tier == null) flags.push("shoe_unknown_condition");
  if (productTypeFromParsedJson(parsed?.category, parsed?.parsed_json) === "type_unknown") flags.push("db_product_type_unknown");

  return {
    pid: Number(row.pid),
    title,
    price: numberPrice(row.price),
    query: row.query,
    rawSkuId: row.sku_id,
    rawSkuCategory: rawCategory,
    currentRuleSkuId: currentSku?.id ?? null,
    currentRuleCategory: currentSku?.category ?? null,
    dbCategory: parsed?.category ?? null,
    dbKey,
    rawReparseKey: rawKey,
    currentRuleKey: currentKey,
    dbParserVersion: parsed?.parser_version ?? null,
    dbNeedsReview: parsed?.needs_review ?? null,
    rawReparseNeedsReview: rawReparse?.needsReview ?? true,
    currentRuleNeedsReview: currentReparse?.needsReview ?? null,
    dbConfidence: parsed?.parse_confidence ?? null,
    rawReparseConfidence: rawReparse?.parseConfidence ?? 0,
    poolStatus: pool?.status ?? null,
    poolProfitBand: pool?.profit_band ?? null,
    mismatchFlags: flags,
    categoryConflictFlags: categoryConflictFlags(rawCategory, text),
    productType: productTypeFromParsedJson(parsed?.category ?? rawCategory, parsed?.parsed_json ?? rawReparse?.parsedJson ?? null),
    conditionNotesCount: Array.isArray(parsed?.condition_notes) ? parsed.condition_notes.length : 0,
    listingState: row.listing_state,
    lastSeenAt: row.last_seen_at,
  };
}

function summarizeSamples(cases: SweepCase[], max = 12) {
  return cases.slice(0, max).map((item) => ({
    pid: item.pid,
    title: item.title,
    price: item.price,
    rawSkuId: item.rawSkuId,
    currentRuleSkuId: item.currentRuleSkuId,
    dbKey: item.dbKey,
    currentRuleKey: item.currentRuleKey,
    dbParserVersion: item.dbParserVersion,
    dbNeedsReview: item.dbNeedsReview,
    poolStatus: item.poolStatus,
    flags: [...new Set([...item.mismatchFlags, ...item.categoryConflictFlags])],
  }));
}

function topEntries(map: Record<string, number>, max = 20) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([key, count]) => ({ key, count }));
}

function buildGroupFindings(cases: SweepCase[]) {
  const byKey = new Map<string, SweepCase[]>();
  for (const item of cases) {
    if (!item.dbKey || item.dbNeedsReview === true || (item.dbConfidence ?? 0) < 0.65) continue;
    const list = byKey.get(item.dbKey) ?? [];
    list.push(item);
    byKey.set(item.dbKey, list);
  }
  return [...byKey.entries()]
    .map(([key, rows]) => {
      const prices = rows.map((r) => r.price).filter((v): v is number => v != null);
      const rawSkuIds = [...new Set(rows.map((r) => r.rawSkuId).filter(Boolean))];
      const currentSkuIds = [...new Set(rows.map((r) => r.currentRuleSkuId).filter(Boolean))];
      const mismatchRows = rows.filter((r) => r.mismatchFlags.some((f) => f.includes("current_catalog") || f.includes("parsed_stale") || f.includes("db_clean")));
      const conflictRows = rows.filter((r) => r.categoryConflictFlags.length > 0);
      const p10 = percentile(prices, 0.1);
      const p90 = percentile(prices, 0.9);
      const priceSpread = p10 && p90 ? p90 / Math.max(1, p10) : null;
      const score =
        mismatchRows.length * 4 +
        conflictRows.length * 2 +
        Math.max(0, rawSkuIds.length - 1) * 3 +
        (priceSpread && priceSpread >= 3 ? 3 : 0) +
        rows.length / 20;
      return {
        key,
        count: rows.length,
        score,
        rawSkuIds,
        currentSkuIds,
        mismatchCount: mismatchRows.length,
        categoryConflictCount: conflictRows.length,
        priceMedian: median(prices),
        priceP10: p10,
        priceP90: p90,
        priceSpread,
        samples: summarizeSamples([...mismatchRows, ...conflictRows, ...rows].slice(0, 8), 8),
      };
    })
    .filter((g) => g.mismatchCount > 0 || g.categoryConflictCount > 0 || g.rawSkuIds.length > 1 || (g.priceSpread ?? 0) >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);
}

function buildMarkdown(report: {
  generatedAt: string;
  scope: Record<string, unknown>;
  summary: Record<string, unknown>;
  parserVersions: Record<string, number>;
  productTypeStats: Record<string, number>;
  mismatchFlags: Record<string, number>;
  categoryConflictFlags: Record<string, number>;
  topRawSkuMismatch: Array<{ key: string; count: number }>;
  flaggedGroups: ReturnType<typeof buildGroupFindings>;
  prioritySamples: ReturnType<typeof summarizeSamples>;
  nullSkuWouldMatch: Array<Record<string, unknown>>;
  nullSkuCoverageHoles: Array<Record<string, unknown>>;
}) {
  const lines: string[] = [];
  lines.push("# Fashion/Shoe DB Sweep");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push("## Scope");
  for (const [key, value] of Object.entries(report.scope)) lines.push(`- ${key}: ${String(value)}`);
  lines.push("");
  lines.push("## Summary");
  for (const [key, value] of Object.entries(report.summary)) lines.push(`- ${key}: ${String(value)}`);
  lines.push("");
  lines.push("## Parser Versions");
  for (const item of topEntries(report.parserVersions, 40)) lines.push(`- ${item.key}: ${item.count}`);
  lines.push("");
  lines.push("## Product Type Stats");
  for (const item of topEntries(report.productTypeStats, 40)) lines.push(`- ${item.key}: ${item.count}`);
  lines.push("");
  lines.push("## Mismatch Flags");
  for (const item of topEntries(report.mismatchFlags, 40)) lines.push(`- ${item.key}: ${item.count}`);
  lines.push("");
  lines.push("## Category Conflict Flags");
  for (const item of topEntries(report.categoryConflictFlags, 40)) lines.push(`- ${item.key}: ${item.count}`);
  lines.push("");
  lines.push("## Top Raw SKU Mismatch");
  for (const item of report.topRawSkuMismatch.slice(0, 20)) lines.push(`- ${item.key}: ${item.count}`);
  lines.push("");
  lines.push("## Flagged Comparable Groups");
  for (const group of report.flaggedGroups.slice(0, 12)) {
    lines.push(`### ${group.key}`);
    lines.push(`- count=${group.count}, mismatch=${group.mismatchCount}, categoryConflict=${group.categoryConflictCount}, median=${group.priceMedian ?? "n/a"}, p10=${group.priceP10 ?? "n/a"}, p90=${group.priceP90 ?? "n/a"}`);
    lines.push(`- rawSkuIds=${group.rawSkuIds.join(", ") || "n/a"}`);
    for (const sample of group.samples.slice(0, 5)) {
      lines.push(`- pid ${sample.pid}: ${sample.title} / raw=${sample.rawSkuId} / current=${sample.currentRuleSkuId} / pool=${sample.poolStatus ?? "none"} / flags=${sample.flags.join(",")}`);
    }
    lines.push("");
  }
  lines.push("## Priority Samples");
  for (const sample of report.prioritySamples) {
    lines.push(`- pid ${sample.pid}: ${sample.title} / raw=${sample.rawSkuId} / current=${sample.currentRuleSkuId} / dbKey=${sample.dbKey} / currentKey=${sample.currentRuleKey} / pool=${sample.poolStatus ?? "none"} / flags=${sample.flags.join(",")}`);
  }
  lines.push("");
  lines.push("## Null SKU Would Match Now");
  for (const sample of report.nullSkuWouldMatch.slice(0, 12)) {
    lines.push(`- pid ${sample.pid}: ${sample.title} / current=${sample.currentRuleSkuId} / key=${sample.currentRuleKey}`);
  }
  lines.push("");
  lines.push("## Null SKU Coverage Holes");
  for (const sample of report.nullSkuCoverageHoles.slice(0, 12)) {
    lines.push(`- pid ${sample.pid}: ${sample.title}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });
  await mkdir(decisionDir, { recursive: true });

  const windowHours = Number(arg("window-hours", "168"));
  const rawLimit = Number(arg("raw-limit", "30000"));
  const nullLimit = Number(arg("null-limit", "8000"));
  const skuFilter = arg("sku-filter", "");
  const sinceIso = hoursAgo(windowHours);

  console.error(`[fashion-sweep] fetching raw fashion SKU rows since ${sinceIso} limit=${rawLimit}${skuFilter ? ` sku-filter=${skuFilter}` : ""}`);
  const rawRows = await fetchRecentFashionSkuRaw(sinceIso, rawLimit, skuFilter);
  console.error(`[fashion-sweep] raw rows=${rawRows.length}; fetching parsed rows`);
  const parsedRows = await fetchParsedByPid(rawRows.map((r) => Number(r.pid)));
  console.error(`[fashion-sweep] parsed rows=${parsedRows.length}; fetching pool rows`);
  const poolRows = await fetchPoolByPid(rawRows.map((r) => Number(r.pid)));
  console.error(`[fashion-sweep] pool rows=${poolRows.length}; replaying current catalog/parser`);
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));
  const poolByPid = new Map(poolRows.map((row) => [Number(row.pid), row]));

  const cases = rawRows.map((row) => makeSweepCase(row, parsedByPid.get(Number(row.pid)), poolByPid.get(Number(row.pid))));
  const mismatchFlags: Record<string, number> = {};
  const categoryConflictFlagsMap: Record<string, number> = {};
  const parserVersions: Record<string, number> = {};
  const productTypeStats: Record<string, number> = {};
  const rawSkuMismatchMap: Record<string, number> = {};

  for (const item of cases) {
    for (const flag of item.mismatchFlags) inc(mismatchFlags, flag);
    for (const flag of item.categoryConflictFlags) inc(categoryConflictFlagsMap, flag);
    inc(parserVersions, `${item.dbCategory ?? item.rawSkuCategory ?? "unknown"}:${item.dbParserVersion ?? "missing"}`);
    inc(productTypeStats, `${item.rawSkuCategory ?? "unknown"}:${item.productType ?? "missing"}`);
    if (item.currentRuleSkuId !== item.rawSkuId) inc(rawSkuMismatchMap, `${item.rawSkuId ?? "null"} -> ${item.currentRuleSkuId ?? "null"}`);
  }

  const flaggedGroups = buildGroupFindings(cases);
  console.error(`[fashion-sweep] cases=${cases.length}; flagged groups=${flaggedGroups.length}; fetching null sku rows`);
  const priorityCases = cases
    .filter((item) =>
      item.poolStatus === "ready" ||
      item.poolStatus === "reserved" ||
      item.mismatchFlags.includes("db_clean_but_current_catalog_rejects") ||
      item.mismatchFlags.includes("db_clean_but_current_catalog_changes_key") ||
      item.mismatchFlags.includes("raw_sku_rejected_by_current_catalog") ||
      item.mismatchFlags.includes("raw_sku_differs_from_current_catalog")
    )
    .sort((a, b) => {
      const aw = (a.poolStatus === "ready" || a.poolStatus === "reserved" ? 100 : 0) + a.mismatchFlags.length * 5 + a.categoryConflictFlags.length * 2;
      const bw = (b.poolStatus === "ready" || b.poolStatus === "reserved" ? 100 : 0) + b.mismatchFlags.length * 5 + b.categoryConflictFlags.length * 2;
      return bw - aw;
    });

  const nullRows = await fetchRecentNullSkuRaw(sinceIso, nullLimit);
  console.error(`[fashion-sweep] null sku rows=${nullRows.length}; replaying null sku fashion sample`);
  const nullSkuWouldMatch = [];
  const nullSkuCoverageHoles = [];
  for (const row of nullRows) {
    const title = row.name ?? "";
    const text = `${title}\n${row.description_preview ?? ""}`;
    if (!fashionKeywordHit(text)) continue;
    const current = ruleMatch(title, row.description_preview ?? "");
    if (current && isFashionCategory(current.category)) {
      const parsed = parseWithSku(row, current);
      nullSkuWouldMatch.push({
        pid: row.pid,
        title,
        price: row.price,
        currentRuleSkuId: current.id,
        currentRuleKey: parsed?.comparableKey ?? null,
        needsReview: parsed?.needsReview ?? null,
      });
    } else {
      nullSkuCoverageHoles.push({
        pid: row.pid,
        title,
        price: row.price,
        query: row.query,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    scope: {
      windowHours,
      sinceIso,
      rawFashionSkuRows: rawRows.length,
      parsedRows: parsedRows.length,
      poolRows: poolRows.length,
      nullSkuRowsSampled: nullRows.length,
    },
    summary: {
      rawSkuRejectedByCurrentCatalog: mismatchFlags.raw_sku_rejected_by_current_catalog ?? 0,
      rawSkuDiffersFromCurrentCatalog: mismatchFlags.raw_sku_differs_from_current_catalog ?? 0,
      dbCleanButCurrentCatalogRejects: mismatchFlags.db_clean_but_current_catalog_rejects ?? 0,
      dbCleanButCurrentCatalogChangesKey: mismatchFlags.db_clean_but_current_catalog_changes_key ?? 0,
      parsedStaleVersion: mismatchFlags.parsed_stale_version ?? 0,
      poolExposedWithDrift: mismatchFlags.pool_exposed_with_catalog_or_parser_drift ?? 0,
      shoeDefaultedToSneaker: mismatchFlags.shoe_product_type_defaulted_to_sneaker ?? 0,
      shoeUnknownSize: mismatchFlags.shoe_unknown_size ?? 0,
      shoeUnknownCondition: mismatchFlags.shoe_unknown_condition ?? 0,
      dbProductTypeUnknown: mismatchFlags.db_product_type_unknown ?? 0,
      flaggedComparableGroups: flaggedGroups.length,
      nullSkuWouldMatchNow: nullSkuWouldMatch.length,
      nullSkuFashionCoverageHoles: nullSkuCoverageHoles.length,
    },
    parserVersions,
    productTypeStats,
    mismatchFlags,
    categoryConflictFlags: categoryConflictFlagsMap,
    topRawSkuMismatch: topEntries(rawSkuMismatchMap, 40),
    flaggedGroups,
    prioritySamples: summarizeSamples(priorityCases, 40),
    nullSkuWouldMatch: nullSkuWouldMatch.slice(0, 80),
    nullSkuCoverageHoles: nullSkuCoverageHoles.slice(0, 80),
  };

  const reportBaseName = skuFilter ? "fashion-shoe-db-sweep-targeted-latest" : "fashion-shoe-db-sweep-latest";
  const jsonPath = path.join(reportsDir, `${reportBaseName}.json`);
  const mdPath = path.join(reportsDir, `${reportBaseName}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, buildMarkdown(report));

  const decisionPath = path.join(decisionDir, "2026-05-20-wave405-fashion-shoe-db-sweep.md");
  const decision = [
    "# 2026-05-20 Wave 405 - Fashion/Shoe DB Sweep",
    "",
    "## Decision",
    "- Ran a read-only DB sweep focused on fashion raw SKU drift, parser-version drift, product-type unknowns, and comparable-key contamination.",
    "- Treat `mvp_raw_listings.sku_id` drift as the first-class risk because market sample reparsing currently trusts stored raw SKU IDs.",
    "",
    "## Findings Snapshot",
    `- raw SKU rejected by current catalog: ${report.summary.rawSkuRejectedByCurrentCatalog}`,
    `- raw SKU differs from current catalog: ${report.summary.rawSkuDiffersFromCurrentCatalog}`,
    `- DB-clean rows that current catalog rejects: ${report.summary.dbCleanButCurrentCatalogRejects}`,
    `- pool exposed with catalog/parser drift: ${report.summary.poolExposedWithDrift}`,
    `- flagged comparable groups: ${report.summary.flaggedComparableGroups}`,
    `- null SKU rows that would match current catalog now: ${report.summary.nullSkuWouldMatchNow}`,
    "",
    "## Deferred",
    "- No DB mutation in this wave. If confirmed, next step is a no-write reclassification plan for stale fashion `sku_id` rows, then a capped apply/backfill.",
    "- Catalog/parser patches should be driven by the top flagged samples rather than broad hand edits.",
    "",
    "## Artifacts",
    `- \`reports/${reportBaseName}.json\``,
    `- \`reports/${reportBaseName}.md\``,
    "",
  ].join("\n");
  await writeFile(decisionPath, decision);

  console.log(JSON.stringify({
    jsonPath,
    mdPath,
    decisionPath,
    summary: report.summary,
    topFlags: topEntries(report.mismatchFlags, 12),
    topRawSkuMismatch: report.topRawSkuMismatch.slice(0, 8),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
