import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { summarizeConditionChips } from "@/lib/condition-chip-policy";
import { mergeConditionDisplayChips } from "@/lib/condition-display";
import { normalizeMarketplaceSource } from "@/lib/marketplace-source";
import {
  conditionResaleAdjustmentKrw,
  resellShippingFeeForSource,
  safetyBufferForSource,
  sellingFeeForMarketPrice,
} from "@/lib/profit";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

type PoolRow = {
  pid: number;
  status: string | null;
  category: string | null;
  condition_class: string | null;
  expected_profit_min: number | null;
  expected_profit_max: number | null;
};

type ListingRow = {
  pid: number;
  name: string | null;
  price: number | null;
  sku_median: number | null;
  shipping_fee: number | null;
  shipping_fee_general: number | null;
  estimated_buy_cost: number | null;
};

type RawRow = {
  pid: number;
  source: string | null;
  seller_source: string | null;
};

type ParsedRow = {
  pid: number;
  condition_class: string | null;
  condition_tier: string | null;
  condition_notes: string[] | null;
  parsed_json: Record<string, unknown> | null;
};

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      process.env[key] ??= rest.join("=").trim().replace(/^["']|["']$/g, "");
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

function inList(values: Array<number | string>) {
  return `(${values.join(",")})`;
}

async function restJson<T>(url: string): Promise<T[]> {
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as T[];
}

async function fetchAll<T>(baseUrl: string, limit: number, orderBy: string) {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < limit; offset += pageSize) {
    const pageLimit = Math.min(pageSize, limit - offset);
    const sep = baseUrl.includes("?") ? "&" : "?";
    const page = await restJson<T>(`${baseUrl}${sep}order=${encodeURIComponent(orderBy)}&limit=${pageLimit}&offset=${offset}`);
    rows.push(...page);
    if (page.length < pageLimit) break;
  }
  return rows;
}

async function fetchByPid<T>(table: string, select: string, pids: number[]) {
  const rows: T[] = [];
  for (const part of chunk([...new Set(pids)], 400)) {
    rows.push(...await restJson<T>(
      `${tableUrl(table)}?select=${select}&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

function positiveNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function countBy<T>(rows: T[], fn: (row: T) => string | null | undefined) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const key = fn(row) ?? "unknown";
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function pct(part: number, total: number) {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10;
}

function mdTable(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((cell) => String(cell ?? "")).join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const limit = Number(arg("limit", "10000"));
  const statuses = arg("statuses", "ready,reserved")
    .split(",")
    .map((status) => status.trim())
    .filter(Boolean);
  const poolRows = await fetchAll<PoolRow>(
    `${tableUrl("mvp_candidate_pool")}?select=pid,status,category,condition_class,expected_profit_min,expected_profit_max&status=in.(${statuses.join(",")})`,
    limit,
    "updated_at.desc",
  );
  const pids = poolRows.map((row) => Number(row.pid)).filter(Number.isFinite);
  const [listingRows, rawRows, parsedRows] = await Promise.all([
    fetchByPid<ListingRow>("mvp_listings", "pid,name,price,sku_median,shipping_fee,shipping_fee_general,estimated_buy_cost", pids),
    fetchByPid<RawRow>("mvp_raw_listings", "pid,source,seller_source", pids),
    fetchByPid<ParsedRow>("mvp_listing_parsed", "pid,condition_class,condition_tier,condition_notes,parsed_json", pids),
  ]);

  const listingByPid = new Map(listingRows.map((row) => [Number(row.pid), row]));
  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));

  const auditedRows = poolRows.flatMap((pool) => {
    const pid = Number(pool.pid);
    const listing = listingByPid.get(pid);
    const raw = rawByPid.get(pid);
    const parsed = parsedByPid.get(pid);
    const marketPrice = positiveNumber(listing?.sku_median);
    const buyPrice = positiveNumber(listing?.price);
    if (marketPrice == null || buyPrice == null) return [];
    const grade = (parsed?.parsed_json?.condition_grade as { chips?: string[]; tier?: string } | null) ?? null;
    const parsedJsonNotes = parsed?.parsed_json?.condition_notes as string[] | undefined;
    const chips = mergeConditionDisplayChips(grade?.chips ?? null, parsed?.condition_notes ?? parsedJsonNotes ?? null) ?? [];
    const summary = summarizeConditionChips(chips);
    const source = normalizeMarketplaceSource(raw?.source ?? raw?.seller_source ?? null);
    const shippingFee = Number(listing?.shipping_fee ?? 0);
    const generalShipping = listing?.shipping_fee_general == null ? shippingFee : Number(listing.shipping_fee_general ?? 0);
    const buyMin = positiveNumber(listing?.estimated_buy_cost) ?? buyPrice + shippingFee;
    const buyMax = buyPrice + Math.max(0, generalShipping);
    const oldSellFee = sellingFeeForMarketPrice(marketPrice, source);
    const resellShipping = resellShippingFeeForSource(source);
    const safetyBuffer = safetyBufferForSource(source);
    const oldProfitMin = Math.max(0, Math.round(marketPrice - buyMax - oldSellFee - resellShipping - safetyBuffer));
    const oldProfitMax = Math.max(0, Math.round(marketPrice - buyMin - oldSellFee - resellShipping - safetyBuffer));
    const conditionAdjustment = conditionResaleAdjustmentKrw({
      marketPrice,
      conditionChips: chips,
      conditionClass: pool.condition_class ?? parsed?.condition_class ?? null,
      conditionTier: parsed?.condition_tier ?? grade?.tier ?? null,
    });
    const adjustedMarketPrice = Math.max(0, marketPrice - conditionAdjustment);
    const newSellFee = sellingFeeForMarketPrice(adjustedMarketPrice, source);
    const newProfitMin = Math.max(0, Math.round(adjustedMarketPrice - buyMax - newSellFee - resellShipping - safetyBuffer));
    const newProfitMax = Math.max(0, Math.round(adjustedMarketPrice - buyMin - newSellFee - resellShipping - safetyBuffer));
    return [{
      pid,
      title: listing?.name ?? "",
      status: pool.status,
      source,
      category: pool.category,
      marketPrice,
      price: buyPrice,
      conditionClass: pool.condition_class ?? parsed?.condition_class ?? null,
      conditionTier: parsed?.condition_tier ?? grade?.tier ?? null,
      chips,
      softAdjustment: summary.softAdjustment,
      conditionAdjustment,
      oldProfitMin,
      oldProfitMax,
      newProfitMin,
      newProfitMax,
      profitMaxDrop: oldProfitMax - newProfitMax,
      poolExpectedProfitMax: Number(pool.expected_profit_max ?? 0),
      wouldLosePositiveProfit: oldProfitMax > 0 && newProfitMax <= 0,
    }];
  });

  const affectedRows = auditedRows.filter((row) => row.conditionAdjustment > 0);
  const wouldLosePositiveRows = affectedRows.filter((row) => row.wouldLosePositiveProfit);
  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    mutation: false,
    scope: {
      statuses,
      limit,
      poolRows: poolRows.length,
      auditedRows: auditedRows.length,
    },
    metrics: {
      affectedRows: affectedRows.length,
      affectedRate: pct(affectedRows.length, auditedRows.length),
      wouldLosePositiveProfitRows: wouldLosePositiveRows.length,
      wouldLosePositiveProfitRate: pct(wouldLosePositiveRows.length, auditedRows.length),
      totalProfitMaxDrop: affectedRows.reduce((sum, row) => sum + row.profitMaxDrop, 0),
      avgProfitMaxDropAffected: affectedRows.length === 0
        ? 0
        : Math.round(affectedRows.reduce((sum, row) => sum + row.profitMaxDrop, 0) / affectedRows.length),
    },
    affectedBySource: countBy(affectedRows, (row) => row.source),
    affectedByCategory: countBy(affectedRows, (row) => row.category),
    affectedSoftChipCounts: countBy(
      affectedRows.flatMap((row) => row.softAdjustment.map((chip) => ({ chip }))),
      (row) => row.chip,
    ),
    topDrops: affectedRows
      .sort((a, b) => b.profitMaxDrop - a.profitMaxDrop)
      .slice(0, 50),
    wouldLosePositiveProfitSamples: wouldLosePositiveRows
      .sort((a, b) => b.profitMaxDrop - a.profitMaxDrop)
      .slice(0, 50),
  };

  await writeFile(path.join(reportsDir, "condition-profit-haircut-impact-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    "# Condition Profit Haircut Impact",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Metrics",
    "",
    mdTable(["metric", "value"], Object.entries(report.metrics)),
    "",
    "## Affected By Source",
    "",
    mdTable(["source", "count"], Object.entries(report.affectedBySource)),
    "",
    "## Affected Soft Chips",
    "",
    mdTable(["chip", "count"], Object.entries(report.affectedSoftChipCounts)),
    "",
    "## Top Drops",
    "",
    mdTable(
      ["pid", "source", "category", "adjustment", "oldMax", "newMax", "chips", "title"],
      report.topDrops.slice(0, 20).map((row) => [
        row.pid,
        row.source,
        row.category,
        row.conditionAdjustment,
        row.oldProfitMax,
        row.newProfitMax,
        row.softAdjustment.join(", "),
        row.title.slice(0, 70),
      ]),
    ),
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "condition-profit-haircut-impact-latest.md"), `${md}\n`);
  console.log(JSON.stringify({
    reportJson: "reports/condition-profit-haircut-impact-latest.json",
    reportMd: "reports/condition-profit-haircut-impact-latest.md",
    metrics: report.metrics,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
