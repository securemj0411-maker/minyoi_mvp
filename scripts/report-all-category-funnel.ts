import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { CATALOG, skuById } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";
import { restFetchAll } from "@/lib/rest-paginated";
import { tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

type RawRow = {
  pid: number;
  sku_id: string | null;
  detail_status: string | null;
  listing_state: string | null;
  listing_type: string | null;
  listing_type_override: string | null;
  pool_eligible: boolean | null;
  score_dirty: boolean | null;
  last_seen_at: string | null;
};

type ParsedRow = {
  pid: number;
  category: string | null;
  parser_version: string | null;
  comparable_key: string | null;
  parse_confidence: number | null;
  needs_review: boolean | null;
};

type PoolRow = {
  pid: number;
  category: string | null;
  status: string | null;
  invalidated_reason: string | null;
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
    // Optional local env.
  }
}

function inc(map: Record<string, number>, key: string | null | undefined) {
  const k = key || "(null)";
  map[k] = (map[k] ?? 0) + 1;
}

function top(map: Record<string, number>, limit = 12) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function isRawEligible(row: RawRow) {
  const normalListing = row.listing_type === "normal" || row.listing_type_override === "normal";
  return row.detail_status === "done" &&
    row.listing_state === "active" &&
    normalListing &&
    row.pool_eligible !== false &&
    Boolean(row.sku_id);
}

function isRecent(iso: string | null, days: number) {
  if (!iso) return false;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && ms >= Date.now() - days * 24 * 60 * 60 * 1000;
}

async function fetchRawRowsByCatalogSkus() {
  const rows = new Map<number, RawRow>();
  const skuIds = [...new Set(CATALOG.map((sku) => sku.id))].sort();
  for (const part of chunk(skuIds, 25)) {
    const encoded = part.map(encodeURIComponent).join(",");
    const batch = await restFetchAll<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,detail_status,listing_state,listing_type,listing_type_override,pool_eligible,score_dirty,last_seen_at&sku_id=in.(${encoded})`,
      { orderBy: "pid.asc" },
    );
    for (const row of batch) rows.set(Number(row.pid), row);
  }
  return [...rows.values()];
}

function parserExpectedByCategory() {
  const byCategory = new Map<string, string>();
  for (const sku of CATALOG) {
    if (byCategory.has(sku.category)) continue;
    const parsed = parseListingOptions({
      title: sku.modelName,
      description: "",
      skuId: sku.id,
      skuName: sku.modelName,
      category: sku.category,
      defaultProductType: sku.defaultProductType ?? null,
    });
    byCategory.set(sku.category, parsed.parserVersion);
  }
  return Object.fromEntries([...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const catalogCategories = [...new Set(CATALOG.map((sku) => sku.category))].sort();
  const expected = parserExpectedByCategory();
  const [rawRows, parsedRows, poolRows] = await Promise.all([
    fetchRawRowsByCatalogSkus(),
    restFetchAll<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=pid,category,parser_version,comparable_key,parse_confidence,needs_review`,
      { orderBy: "pid.asc" },
    ),
    restFetchAll<PoolRow>(
      `${tableUrl("mvp_candidate_pool")}?select=pid,category,status,invalidated_reason`,
      { orderBy: "pid.asc" },
    ),
  ]);

  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));
  const poolByPid = new Map(poolRows.map((row) => [Number(row.pid), row]));
  const summary: Record<string, {
    catalogSkus: number;
    rawSkuMatched: number;
    rawEligible: number;
    rawSeen7d: number;
    rawScoreDirty: number;
    parsedRows: number;
    parserExpected: string | null;
    parserMismatch: number;
    parserVersions: Array<{ key: string; count: number }>;
    ready: number;
    reserved: number;
    invalidated: number;
    eligibleReady: number;
    eligibleInvalidated: number;
    eligibleNoPool: number;
    topInvalidatedReasons: Array<{ key: string; count: number }>;
  }> = {};

  for (const category of catalogCategories) {
    summary[category] = {
      catalogSkus: CATALOG.filter((sku) => sku.category === category).length,
      rawSkuMatched: 0,
      rawEligible: 0,
      rawSeen7d: 0,
      rawScoreDirty: 0,
      parsedRows: 0,
      parserExpected: expected[category] ?? null,
      parserMismatch: 0,
      parserVersions: [],
      ready: 0,
      reserved: 0,
      invalidated: 0,
      eligibleReady: 0,
      eligibleInvalidated: 0,
      eligibleNoPool: 0,
      topInvalidatedReasons: [],
    };
  }

  for (const raw of rawRows) {
    const category = raw.sku_id ? skuById(raw.sku_id)?.category : null;
    if (!category || !summary[category]) continue;
    const item = summary[category];
    item.rawSkuMatched += 1;
    if (isRawEligible(raw)) item.rawEligible += 1;
    if (isRecent(raw.last_seen_at, 7)) item.rawSeen7d += 1;
    if (raw.score_dirty === true) item.rawScoreDirty += 1;
  }

  const versionCountsByCategory = new Map<string, Record<string, number>>();
  for (const parsed of parsedRows) {
    const category = parsed.category ?? "";
    if (!summary[category]) continue;
    summary[category].parsedRows += 1;
    const expectedVersion = expected[category] ?? null;
    if (expectedVersion && parsed.parser_version !== expectedVersion) summary[category].parserMismatch += 1;
    if (!versionCountsByCategory.has(category)) versionCountsByCategory.set(category, {});
    inc(versionCountsByCategory.get(category)!, parsed.parser_version);
  }
  for (const [category, counts] of versionCountsByCategory.entries()) {
    summary[category].parserVersions = top(counts, 8);
  }

  const invalidReasonsByCategory = new Map<string, Record<string, number>>();
  for (const pool of poolRows) {
    const raw = rawByPid.get(Number(pool.pid));
    const parsed = parsedByPid.get(Number(pool.pid));
    const category = pool.category ?? parsed?.category ?? (raw?.sku_id ? skuById(raw.sku_id)?.category : null) ?? "";
    if (!summary[category]) continue;
    if (pool.status === "ready") summary[category].ready += 1;
    if (pool.status === "reserved") summary[category].reserved += 1;
    if (pool.status === "invalidated") {
      summary[category].invalidated += 1;
      if (!invalidReasonsByCategory.has(category)) invalidReasonsByCategory.set(category, {});
      inc(invalidReasonsByCategory.get(category)!, pool.invalidated_reason);
    }
    if (raw && isRawEligible(raw)) {
      if (pool.status === "ready") summary[category].eligibleReady += 1;
      else if (pool.status === "invalidated") summary[category].eligibleInvalidated += 1;
    }
  }
  for (const category of catalogCategories) {
    const item = summary[category];
    item.eligibleNoPool = Math.max(0, item.rawEligible - item.eligibleReady - item.eligibleInvalidated);
    item.topInvalidatedReasons = top(invalidReasonsByCategory.get(category) ?? {}, 10);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      categories: catalogCategories.length,
      rawRows: rawRows.length,
      parsedRows: parsedRows.length,
      poolRows: poolRows.length,
    },
    summary,
  };

  const jsonPath = path.join(reportsDir, "all-category-funnel-latest.json");
  const mdPath = path.join(reportsDir, "all-category-funnel-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, [
    "# All Category Funnel",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Totals",
    ...Object.entries(report.totals).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Category Summary",
    "| category | raw | eligible | dirty | parsed | parser mismatch | ready | invalidated | eligible no-pool | top invalidation |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ...catalogCategories.map((category) => {
      const row = summary[category];
      const topReason = row.topInvalidatedReasons[0];
      return `| ${category} | ${row.rawSkuMatched} | ${row.rawEligible} | ${row.rawScoreDirty} | ${row.parsedRows} | ${row.parserMismatch} | ${row.ready} | ${row.invalidated} | ${row.eligibleNoPool} | ${topReason ? `${topReason.key} (${topReason.count})` : "-"} |`;
    }),
    "",
    "## Parser Versions",
    ...catalogCategories.flatMap((category) => [
      `### ${category}`,
      `- expected: ${summary[category].parserExpected ?? "-"}`,
      ...summary[category].parserVersions.map((item) => `- ${item.key}: ${item.count}`),
      "",
    ]),
  ].join("\n"));

  console.log(JSON.stringify({
    jsonPath,
    mdPath,
    totals: report.totals,
    topParserMismatch: Object.entries(summary)
      .map(([category, row]) => ({ category, parserMismatch: row.parserMismatch, parsedRows: row.parsedRows, expected: row.parserExpected }))
      .filter((row) => row.parserMismatch > 0)
      .sort((a, b) => b.parserMismatch - a.parserMismatch)
      .slice(0, 15),
    topEligibleNoPool: Object.entries(summary)
      .map(([category, row]) => ({ category, eligibleNoPool: row.eligibleNoPool, rawEligible: row.rawEligible, ready: row.ready }))
      .sort((a, b) => b.eligibleNoPool - a.eligibleNoPool)
      .slice(0, 15),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
