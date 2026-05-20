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

function inList(nums: number[]) {
  return `(${nums.join(",")})`;
}

async function fetchJson<T>(url: string): Promise<T[]> {
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as T[];
}

function currentSkuForPool(row: RawRow): Sku | null {
  return ruleMatch(row.name ?? "", row.description_preview ?? "") ?? null;
}

function reparse(row: RawRow, sku: Sku | null) {
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

function categoryConflictFlags(category: string | null | undefined, text: string) {
  let t = text.toLowerCase();
  // Ignore common bag names and sale-policy/accessory phrases that contain
  // words like belt, clothing, or bag without changing the product category.
  t = t
    .replace(/벨트백|belt bag|웨이스트백|waist bag|힙색|슬링백|slingback/g, " ")
    .replace(/의류\/잡화|의류 잡화|clothing\/accessor(?:y|ies)/g, " ")
    .replace(/보관\s*가방|더스트백|dust bag|슈즈백|shoe bag|신발\s*주머니/g, " ");
  const flags: string[] = [];
  const clothing = /트랙팬츠|트랙 팬츠|바지|팬츠|자켓|재킷|패딩|코트|후드|맨투맨|티셔츠|반팔|롱슬리브|셔츠|쇼츠|청바지|데님|니트|가디건|모자|볼캡|벨트|pants|jacket|hoodie|shirt|shorts|denim|jeans|cap|belt/.test(t);
  const shoe = /운동화|스니커|스니커즈|부츠|샌들|슬리퍼|로퍼|슈즈|러닝화|등산화|트레킹화|축구화|풋살화|sneaker|shoe|shoes|boot|sandal|loafer|slipper/.test(t);
  const bag = /가방|백팩|토트|숄더|크로스백|메신저|더플|클러치|파우치|지갑|카드지갑|월렛|bag|backpack|tote|shoulder|crossbody|wallet|pouch/.test(t);
  // Shoe descriptions often mention styling context like "데님/팬츠에 코디 가능".
  // Treat clothing/bag terms as a conflict only when the row lacks strong shoe language.
  if (category === "shoe" && clothing && !shoe) flags.push("shoe_row_has_clothing_terms");
  if (category === "shoe" && bag && !shoe) flags.push("shoe_row_has_bag_terms");
  if (category === "clothing" && shoe) flags.push("clothing_row_has_shoe_terms");
  if (category === "clothing" && bag) flags.push("clothing_row_has_bag_terms");
  if (category === "bag" && shoe) flags.push("bag_row_has_shoe_terms");
  if (category === "bag" && clothing) flags.push("bag_row_has_clothing_terms");
  return flags;
}

function inc(map: Record<string, number>, key: string | null | undefined) {
  const k = key || "(null)";
  map[k] = (map[k] ?? 0) + 1;
}

function actionableFlags(flags: string[]) {
  return flags.filter((flag) =>
    !flag.startsWith("parsed_key_drift") &&
    !flag.startsWith("raw_sku_now_") &&
    flag !== "pool_key_differs_current_key"
  );
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const statuses = arg("statuses", "ready,reserved").split(",").map((item) => item.trim()).filter(Boolean);
  const categoryArg = arg("categories", "shoe,clothing,bag").split(",").map((item) => item.trim()).filter(Boolean);
  const categories = categoryArg.filter((item) => FASHION_CATEGORIES.has(item));
  const poolRows = await fetchJson<PoolRow>(
    `${tableUrl("mvp_candidate_pool")}?select=pid,status,category,comparable_key,expected_profit_min,expected_profit_max,profit_band&category=in.(${categories.join(",")})&status=in.(${statuses.join(",")})&order=expected_profit_min.desc&limit=5000`,
  );
  const pids = [...new Set(poolRows.map((row) => Number(row.pid)).filter(Number.isFinite))];
  const rawRows: RawRow[] = [];
  const parsedRows: ParsedRow[] = [];
  for (const part of chunk(pids, 200)) {
    rawRows.push(...await fetchJson<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sku_name,name,price,description_preview,bunjang_condition_label,sale_status&pid=in.${inList(part)}&limit=${part.length}`,
    ));
    parsedRows.push(...await fetchJson<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=pid,parser_version,comparable_key,parse_confidence,needs_review,parsed_json&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }

  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));
  const rows = poolRows.map((pool) => {
    const pid = Number(pool.pid);
    const raw = rawByPid.get(pid);
    const parsed = parsedByPid.get(pid);
    const storedSku = raw?.sku_id ? skuById(raw.sku_id) ?? null : null;
    const currentSku = raw ? currentSkuForPool(raw) : null;
    const currentParsed = raw ? reparse(raw, currentSku) : null;
    const gate = evaluatePoolGate(
      { sku: currentSku, category: currentSku?.category ?? pool.category as Sku["category"] | null },
      { categoryReadiness: CATEGORY_READINESS, laneReadiness: LANE_READINESS },
    );
    const flags = [
      ...(raw ? [] : ["missing_raw_row"]),
      ...(gate.canEnterPool ? [] : [`gate_blocked:${gate.reason}`]),
      ...(storedSku && currentSku?.id !== storedSku.id ? [`raw_sku_now_${currentSku?.id ?? "null"}`] : []),
      ...(pool.category && currentSku?.category && pool.category !== currentSku.category ? [`pool_category_now_${currentSku.category}`] : []),
      ...(pool.comparable_key && currentParsed?.comparableKey && pool.comparable_key !== currentParsed.comparableKey ? ["pool_key_differs_current_key"] : []),
      ...(parsed?.comparable_key && currentParsed?.comparableKey && parsed.comparable_key !== currentParsed.comparableKey ? ["parsed_key_drift"] : []),
      ...categoryConflictFlags(currentSku?.category ?? pool.category, raw?.name ?? ""),
    ];
    return {
      pid,
      status: pool.status,
      poolCategory: pool.category,
      title: raw?.name ?? null,
      price: raw?.price ?? null,
      rawSkuId: raw?.sku_id ?? null,
      rawSkuCategory: storedSku?.category ?? null,
      currentSkuId: currentSku?.id ?? null,
      currentCategory: currentSku?.category ?? null,
      laneKey: currentSku?.laneKey ?? null,
      poolKey: pool.comparable_key,
      currentKey: currentParsed?.comparableKey ?? null,
      gateReason: gate.reason,
      canEnterPool: gate.canEnterPool,
      profitMin: pool.expected_profit_min,
      flags,
      actionableFlags: actionableFlags(flags),
    };
  });

  const byCategory: Record<string, number> = {};
  const byActionableCategory: Record<string, number> = {};
  const byFlag: Record<string, number> = {};
  const byLane: Record<string, number> = {};
  for (const row of rows) {
    inc(byCategory, row.currentCategory ?? row.poolCategory);
    if (row.actionableFlags.length > 0) inc(byActionableCategory, row.currentCategory ?? row.poolCategory);
    for (const flag of row.flags) inc(byFlag, flag);
    if (row.actionableFlags.length > 0) inc(byLane, row.laneKey ?? row.currentSkuId ?? row.rawSkuId);
  }

  const actionableRows = rows.filter((row) => row.actionableFlags.length > 0);
  const report = {
    generatedAt: new Date().toISOString(),
    scope: { statuses, categories, poolRows: rows.length },
    totals: {
      activeFashionPoolRows: rows.length,
      gateBlockedRows: rows.filter((row) => !row.canEnterPool).length,
      flaggedRows: rows.filter((row) => row.flags.length > 0).length,
      actionableRows: actionableRows.length,
    },
    byCategory,
    byActionableCategory,
    byFlag: Object.fromEntries(Object.entries(byFlag).sort((a, b) => b[1] - a[1])),
    byActionableLane: Object.fromEntries(Object.entries(byLane).sort((a, b) => b[1] - a[1])),
    actionableSamples: actionableRows.slice(0, 80),
    flaggedSamples: rows.filter((row) => row.flags.length > 0).slice(0, 80),
  };

  const jsonPath = path.join(reportsDir, "fashion-pool-purity-latest.json");
  const mdPath = path.join(reportsDir, "fashion-pool-purity-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, [
    "# Fashion Pool Purity",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Totals",
    ...Object.entries(report.totals).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## By Category",
    ...Object.entries(report.byCategory).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## By Actionable Category",
    ...Object.entries(report.byActionableCategory).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Top Flags",
    ...Object.entries(report.byFlag).slice(0, 30).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Actionable Samples",
    ...report.actionableSamples.slice(0, 30).map((row) => `- pid ${row.pid}: ${row.title} / pool=${row.poolCategory}:${row.poolKey} / current=${row.currentSkuId}:${row.currentKey} / flags=${row.actionableFlags.join(",")}`),
    "",
  ].join("\n"));

  console.log(JSON.stringify({
    jsonPath,
    mdPath,
    totals: report.totals,
    byCategory: report.byCategory,
    byActionableCategory: report.byActionableCategory,
    topFlags: Object.entries(report.byFlag).slice(0, 12),
    topActionableLanes: Object.entries(report.byActionableLane).slice(0, 12),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
