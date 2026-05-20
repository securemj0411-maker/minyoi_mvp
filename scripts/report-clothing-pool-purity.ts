import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { evaluatePoolGate } from "@/lib/candidate-pool-builder";
import { CATALOG, ruleMatch, skuById, type Sku } from "@/lib/catalog";
import { CATEGORY_READINESS, LANE_READINESS } from "@/lib/category-readiness";
import { parseListingOptions } from "@/lib/option-parser";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = path.join(process.cwd());
const reportsDir = path.join(appDir, "reports");

type PoolRow = {
  pid: number;
  status: string | null;
  category: string | null;
  comparable_key: string | null;
  profit_band: string | null;
  expected_profit_min: number | null;
  expected_profit_max: number | null;
};

type RawRow = {
  pid: number;
  sku_id: string | null;
  sku_name: string | null;
  name: string | null;
  price: number | null;
  description_preview: string | null;
  listing_type: string | null;
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

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchJson<T>(url: string): Promise<T[]> {
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as T[];
}

function inList(nums: number[]) {
  return `(${nums.join(",")})`;
}

function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  return sorted[Math.floor(sorted.length / 2)];
}

function percentile(values: number[], p: number) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))];
}

function effectiveClothingSku(row: Pick<RawRow, "sku_id" | "name" | "description_preview">): Sku | null {
  const stored = row.sku_id ? skuById(row.sku_id) ?? null : null;
  if (stored?.category === "clothing" || row.sku_id?.startsWith("clothing-")) {
    return ruleMatch(row.name ?? "", row.description_preview ?? "") ?? null;
  }
  return stored ?? ruleMatch(row.name ?? "", row.description_preview ?? "") ?? null;
}

function clothingProductType(parsedJson: Record<string, unknown> | null | undefined) {
  return typeof parsedJson?.clothing_product_type === "string" ? parsedJson.clothing_product_type : null;
}

function reparseProductType(row: RawRow, sku: Sku | null) {
  if (!sku) return null;
  const parsed = parseListingOptions({
    title: row.name ?? "",
    description: row.description_preview ?? "",
    skuId: sku.id,
    skuName: sku.modelName,
    category: sku.category,
    defaultProductType: sku.defaultProductType ?? null,
  });
  return {
    comparableKey: parsed.comparableKey,
    productType: clothingProductType(parsed.parsedJson),
    needsReview: parsed.needsReview,
    confidence: parsed.parseConfidence,
  };
}

function expectedProductTypes(laneKey: string | null | undefined) {
  const map: Record<string, string[]> = {
    tnf_nuptse_1996: ["down_jacket"],
    tnf_mountain_jacket: ["jacket"],
    tnf_denali_fleece: ["jacket"],
    tnf_supreme_nuptse: ["down_jacket"],
    tnf_supreme_mountain_jacket: ["jacket"],
    tnf_supreme_mountain_light: ["jacket"],
    tnf_supreme_mountain_parka: ["jacket"],
    tnf_supreme_expedition: ["jacket"],
    tnf_supreme_denali_fleece: ["jacket"],
    tnf_supreme_baltoro: ["down_jacket"],
    polo_rrl_shirt: ["shirt"],
    polo_rrl_pants: ["pants"],
    polo_rrl_denim: ["jeans", "pants", "shorts", "shirt"],
    polo_rrl_jacket_coat: ["jacket", "coat"],
    polo_oxford_shirt: ["shirt"],
    lacoste_pique_polo: ["polo_shirt", "shirt", "tee"],
    bape_shark_hoodie: ["hoodie", "hoodie_zip"],
    arcteryx_beta: ["jacket"],
    arcteryx_gamma: ["jacket"],
    arcteryx_alpha: ["jacket"],
    arcteryx_atom: ["jacket"],
    arcteryx_vertex_squamish: ["jacket"],
    acne_tee: ["tee", "long_sleeve_tee"],
    acne_sweat: ["sweatshirt", "crewneck", "hoodie"],
    acne_denim: ["jeans", "pants", "shorts"],
    fog_essentials_hoodie: ["hoodie"],
    fog_essentials_crewneck: ["crewneck", "sweatshirt"],
    fog_essentials_tee: ["tee", "long_sleeve_tee"],
    fog_essentials_pants: ["pants"],
    fog_essentials_shorts: ["shorts"],
    fog_essentials_jacket: ["jacket"],
    patagonia_deep_pile: ["jacket"],
  };
  return laneKey ? map[laneKey] ?? null : null;
}

function heuristicFlags(laneKey: string | null, title: string, productType: string | null) {
  const t = title.toLowerCase();
  const flags: string[] = [];
  const expected = expectedProductTypes(laneKey);
  if (expected && productType && !expected.includes(productType)) {
    flags.push(`product_type_${productType}_outside_${expected.join("_or_")}`);
  }
  if (laneKey === "tnf_mountain_jacket" && /(purple|퍼플|nanamica|나나미카|하이마운틴|high mountain|마운틴라이트|mountain light|마운틴파카|mountain parka)/i.test(t)) {
    flags.push("tnf_mountain_variant_or_purple_label");
  }
  if (laneKey === "tnf_denali_fleece" && /(팬츠|바지|pants|조거|트레이닝|모자|캡|cap)/i.test(t)) {
    flags.push("tnf_denali_non_jacket_variant");
  }
  if (laneKey === "polo_rrl_jacket_coat" && /(레더|leather|가죽|스웨이드|suede|러프아웃|roughout|시얼링|shearling|플라이트|flight|ma-?1|g-?1)/i.test(t)) {
    flags.push("rrl_jacket_should_route_to_leather_suede_lane");
  }
  if (laneKey === "arcteryx_beta" && /(벨트|belt|팬츠|pants|바지|모자|cap|맨티스|mantis|가방|bag)/i.test(t)) {
    flags.push("arcteryx_beta_non_jacket_variant");
  }
  if (laneKey?.startsWith("fog_essentials") && /(컨버스|converse|척70|신발|운동화|스니커즈)/i.test(t)) {
    flags.push("fog_cross_category_shoe_signal");
  }
  return flags;
}

function actionableFlags(flags: string[]) {
  return flags.filter((flag) => !flag.startsWith("parsed_key_drift") && !flag.startsWith("raw_sku_now_"));
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const poolRows = await fetchJson<PoolRow>(
    `${tableUrl("mvp_candidate_pool")}?select=pid,status,category,comparable_key,profit_band,expected_profit_min,expected_profit_max&category=eq.clothing&status=in.(ready,reserved)&order=expected_profit_min.desc&limit=1000`,
  );
  const pids = [...new Set(poolRows.map((row) => Number(row.pid)).filter(Number.isFinite))];
  const rawRows: RawRow[] = [];
  const parsedRows: ParsedRow[] = [];
  for (const part of chunk(pids, 200)) {
    rawRows.push(...await fetchJson<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sku_name,name,price,description_preview,listing_type,sale_status&pid=in.${inList(part)}&limit=${part.length}`,
    ));
    parsedRows.push(...await fetchJson<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=pid,parser_version,comparable_key,parse_confidence,needs_review,parsed_json&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }

  const poolByPid = new Map(poolRows.map((row) => [Number(row.pid), row]));
  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));

  const rows = pids.map((pid) => {
    const raw = rawByPid.get(pid);
    const parsed = parsedByPid.get(pid);
    const pool = poolByPid.get(pid);
    const sku = raw ? effectiveClothingSku(raw) : null;
    const reparse = raw ? reparseProductType(raw, sku) : null;
    const decision = evaluatePoolGate(
      { sku, category: "clothing" },
      { categoryReadiness: CATEGORY_READINESS, laneReadiness: LANE_READINESS },
    );
    const productType = reparse?.productType ?? clothingProductType(parsed?.parsed_json);
    const flags = [
      ...(decision.canEnterPool ? [] : [`blocked:${decision.reason}`]),
      ...(raw?.sku_id && sku?.id !== raw.sku_id ? [`raw_sku_now_${sku?.id ?? "null"}`] : []),
      ...(parsed?.comparable_key && reparse?.comparableKey && parsed.comparable_key !== reparse.comparableKey ? ["parsed_key_drift"] : []),
      ...heuristicFlags(sku?.laneKey ?? null, raw?.name ?? "", productType),
    ];
    return {
      pid,
      status: pool?.status ?? null,
      title: raw?.name ?? null,
      price: raw?.price ?? null,
      rawSkuId: raw?.sku_id ?? null,
      currentSkuId: sku?.id ?? null,
      laneKey: sku?.laneKey ?? null,
      decision: decision.reason,
      canEnterPool: decision.canEnterPool,
      parserVersion: parsed?.parser_version ?? null,
      dbKey: parsed?.comparable_key ?? null,
      currentKey: reparse?.comparableKey ?? null,
      productType,
      expectedProfitMin: pool?.expected_profit_min ?? null,
      flags,
    };
  });

  const byLane = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.laneKey ?? row.currentSkuId ?? row.rawSkuId ?? "(no lane)";
    const laneRows = byLane.get(key) ?? [];
    laneRows.push(row);
    byLane.set(key, laneRows);
  }

  const laneSummaries = [...byLane.entries()].map(([laneKey, laneRows]) => {
    const prices = laneRows.map((row) => Number(row.price)).filter(Number.isFinite);
    const allowed = laneRows.filter((row) => row.canEnterPool);
    const flagged = laneRows.filter((row) => row.flags.length > 0);
    const p10 = percentile(prices, 0.1);
    const p90 = percentile(prices, 0.9);
    const spread = p10 && p90 ? Number((p90 / Math.max(1, p10)).toFixed(2)) : null;
    const actionable = laneRows.filter((row) => actionableFlags(row.flags).length > 0);
    const score = actionable.length * 5 + (spread && spread >= 4 ? 4 : 0) + (laneRows.length >= 5 && actionable.length > 0 ? 3 : 0);
    return {
      laneKey,
      count: laneRows.length,
      allowedCount: allowed.length,
      flaggedCount: flagged.length,
      actionableCount: actionable.length,
      priceMedian: median(prices),
      priceP10: p10,
      priceP90: p90,
      priceSpread: spread,
      score,
      samples: [...flagged, ...laneRows].slice(0, 8).map((row) => ({
        pid: row.pid,
        title: row.title,
        price: row.price,
        rawSkuId: row.rawSkuId,
        currentSkuId: row.currentSkuId,
        currentKey: row.currentKey,
        productType: row.productType,
        profit: row.expectedProfitMin,
        flags: row.flags,
      })),
    };
  }).sort((a, b) => b.score - a.score || b.allowedCount - a.allowedCount);

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      activeClothingPoolRows: rows.length,
      allowedAfterCurrentGate: rows.filter((row) => row.canEnterPool).length,
      blockedAfterCurrentGate: rows.filter((row) => !row.canEnterPool).length,
      flaggedAllowedRows: rows.filter((row) => row.canEnterPool && row.flags.length > 0).length,
      actionableAllowedRows: rows.filter((row) => row.canEnterPool && actionableFlags(row.flags).length > 0).length,
    },
    laneSummaries,
  };

  const jsonPath = path.join(reportsDir, "clothing-pool-purity-latest.json");
  const mdPath = path.join(reportsDir, "clothing-pool-purity-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, [
    "# Clothing Pool Purity",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Totals",
    ...Object.entries(report.totals).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Top Lane Risks",
    ...laneSummaries.slice(0, 20).flatMap((lane) => [
      `### ${lane.laneKey}`,
      `- count=${lane.count}, allowed=${lane.allowedCount}, flagged=${lane.flaggedCount}, actionable=${lane.actionableCount}, median=${lane.priceMedian ?? "n/a"}, spread=${lane.priceSpread ?? "n/a"}`,
      ...lane.samples.slice(0, 5).map((sample) => `- pid ${sample.pid}: ${sample.title} / current=${sample.currentSkuId} / type=${sample.productType ?? "null"} / flags=${sample.flags.join(",") || "none"}`),
      "",
    ]),
  ].join("\n"));

  console.log(JSON.stringify({
    jsonPath,
    mdPath,
    totals: report.totals,
    topLaneRisks: laneSummaries.slice(0, 12).map((lane) => ({
      laneKey: lane.laneKey,
      count: lane.count,
      allowedCount: lane.allowedCount,
      flaggedCount: lane.flaggedCount,
      actionableCount: lane.actionableCount,
      priceSpread: lane.priceSpread,
      firstSample: lane.samples[0] ?? null,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
