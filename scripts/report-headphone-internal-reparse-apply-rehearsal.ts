import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type ScopePlan = {
  generatedAt: string;
  batches: { batchNo: number; size: number; pids: number[] }[];
};

type RawSnapshot = {
  pid: number;
  name: string | null;
  price: number | null;
  description_preview: string | null;
  listing_type: string | null;
  sku_id: string | null;
  sku_name: string | null;
  listing_state: string | null;
  detail_status: string | null;
  updated_at: string | null;
};

type ParsedSnapshot = {
  pid: number;
  parser_version: string | null;
  category: string | null;
  family: string | null;
  model: string | null;
  variant_key: string | null;
  comparable_key: string | null;
  parse_confidence: number | null;
  condition_score: number | null;
  needs_review: boolean | null;
};

type PoolSnapshot = {
  pid: number;
  status: string | null;
  profit_band: number | null;
  comparable_key: string | null;
  invalidated_reason: string | null;
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
    // optional env file
  }
}

function supabaseBaseUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL required");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY required");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
  };
}

async function restJson<T>(pathname: string): Promise<T> {
  const res = await fetch(`${supabaseBaseUrl()}/rest/v1${pathname}`, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, file), "utf8")) as T;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function fetchByPids<T>(table: string, select: string, pids: number[]) {
  const rows: T[] = [];
  for (const chunk of chunkArray(pids, 120)) {
    rows.push(...await restJson<T[]>(`/${table}?select=${select}&pid=in.(${chunk.join(",")})&limit=${chunk.length}`));
  }
  return rows;
}

function changedFields(existing: Record<string, unknown> | undefined, next: Record<string, unknown>, fields: string[]) {
  const changed: string[] = [];
  for (const field of fields) {
    if ((existing?.[field] ?? null) !== (next[field] ?? null)) changed.push(field);
  }
  return changed;
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function compact(text: unknown, limit = 64) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const plan = await readJson<ScopePlan>("reports/headphone-internal-reparse-scope-plan-latest.json");
  const pids = [...new Set(plan.batches.flatMap((batch) => batch.pids))].sort((a, b) => a - b);
  const rawRows = await fetchByPids<RawSnapshot>(
    "mvp_raw_listings",
    "pid,name,price,description_preview,listing_type,sku_id,sku_name,listing_state,detail_status,updated_at",
    pids,
  );
  const parsedRows = await fetchByPids<ParsedSnapshot>(
    "mvp_listing_parsed",
    "pid,parser_version,category,family,model,variant_key,comparable_key,parse_confidence,condition_score,needs_review",
    pids,
  );
  const poolRows = await fetchByPids<PoolSnapshot>(
    "mvp_candidate_pool",
    "pid,status,profit_band,comparable_key,invalidated_reason",
    pids,
  );

  const parsedByPid = new Map(parsedRows.map((row) => [row.pid, row]));
  const poolByPid = new Map(poolRows.map((row) => [row.pid, row]));
  const rehearsedRows = rawRows.map((row) => {
    const classified = classifyListing(row.name ?? "", row.description_preview ?? "", row.price ?? 0);
    const matchedSku = ruleMatch(row.name ?? "", row.description_preview ?? "");
    const sku = classified.sku ?? matchedSku;
    const parsed = parseListingOptions({
      title: row.name ?? "",
      description: row.description_preview ?? "",
      category: "earphone",
      skuId: sku?.id ?? null,
      skuName: sku?.modelName ?? null,
    });
    const parsedRow = toParsedListingRow(row.pid, parsed);
    const rawPatch = {
      listing_type: classified.listingType,
      sku_id: sku?.id ?? null,
      sku_name: sku?.modelName ?? null,
    };
    const rawChangedFields = changedFields(row as unknown as Record<string, unknown>, rawPatch, ["listing_type", "sku_id", "sku_name"]);
    const parsedChangedFields = changedFields(
      parsedByPid.get(row.pid) as unknown as Record<string, unknown> | undefined,
      parsedRow as unknown as Record<string, unknown>,
      ["parser_version", "category", "family", "model", "variant_key", "comparable_key", "parse_confidence", "condition_score", "needs_review"],
    );
    const pool = poolByPid.get(row.pid);
    const wouldAffectPool = Boolean(pool && parsedChangedFields.includes("comparable_key"));
    return {
      pid: row.pid,
      title: row.name ?? "",
      price: row.price,
      listingState: row.listing_state,
      detailStatus: row.detail_status,
      currentRaw: {
        listingType: row.listing_type,
        skuId: row.sku_id,
        skuName: row.sku_name,
      },
      nextRaw: {
        listingType: rawPatch.listing_type,
        skuId: rawPatch.sku_id,
        skuName: rawPatch.sku_name,
      },
      currentParsed: parsedByPid.get(row.pid) ?? null,
      nextParsed: {
        parserVersion: parsedRow.parser_version,
        category: parsedRow.category,
        family: parsedRow.family,
        model: parsedRow.model,
        variantKey: parsedRow.variant_key,
        comparableKey: parsedRow.comparable_key,
        parseConfidence: parsedRow.parse_confidence,
        conditionScore: parsedRow.condition_score,
        needsReview: parsedRow.needs_review,
      },
      rawChangedFields,
      parsedChangedFields,
      existingPoolStatus: pool?.status ?? null,
      existingPoolBand: pool?.profit_band ?? null,
      existingPoolComparableKey: pool?.comparable_key ?? null,
      wouldAffectPool,
    };
  });

  const changedRows = rehearsedRows.filter((row) => row.rawChangedFields.length || row.parsedChangedFields.length);
  const comparableKeyChangedRows = rehearsedRows.filter((row) => row.parsedChangedFields.includes("comparable_key"));
  const poolAffectedRows = rehearsedRows.filter((row) => row.wouldAffectPool);

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    scope: "AirPods Max headphone internal reparse apply rehearsal; snapshot and diff only",
    sourcePlan: "reports/headphone-internal-reparse-scope-plan-latest.json",
    sourcePlanGeneratedAt: plan.generatedAt,
    metrics: {
      plannedPids: pids.length,
      rawSnapshots: rawRows.length,
      parsedSnapshots: parsedRows.length,
      poolSnapshots: poolRows.length,
      changedRows: changedRows.length,
      rawChangedRows: rehearsedRows.filter((row) => row.rawChangedFields.length).length,
      parsedChangedRows: rehearsedRows.filter((row) => row.parsedChangedFields.length).length,
      comparableKeyChangedRows: comparableKeyChangedRows.length,
      poolAffectedRows: poolAffectedRows.length,
    },
    byNextComparableKey: countBy(rehearsedRows, (row) => String(row.nextParsed.comparableKey ?? "null")),
    byChangedField: countBy(
      changedRows.flatMap((row) => [...row.rawChangedFields.map((field) => `raw.${field}`), ...row.parsedChangedFields.map((field) => `parsed.${field}`)]),
      (field) => field,
    ),
    changedRows: changedRows.slice(0, 80),
    comparableKeyChangedRows,
    poolAffectedRows,
    decision:
      comparableKeyChangedRows.length === 0 && poolAffectedRows.length === 0
        ? "airpods_max_reparse_apply_rehearsal_low_pool_risk"
        : "airpods_max_reparse_apply_rehearsal_needs_pool_diff_review",
    nextStep:
      comparableKeyChangedRows.length === 0 && poolAffectedRows.length === 0
        ? "If owner approves later, run a tiny write-cap dry-run/apply batch for parsed rows only; keep public promotion closed."
        : "Review comparable-key/pool-affecting diffs before any write-cap rehearsal.",
  };

  await writeFile(path.join(reportsDir, "headphone-internal-reparse-apply-rehearsal-latest.json"), `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Headphone Internal Reparse Apply Rehearsal",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision}`,
    "",
    "## Metrics",
    "",
    `- plannedPids: ${report.metrics.plannedPids}`,
    `- rawSnapshots: ${report.metrics.rawSnapshots}`,
    `- parsedSnapshots: ${report.metrics.parsedSnapshots}`,
    `- poolSnapshots: ${report.metrics.poolSnapshots}`,
    `- changedRows: ${report.metrics.changedRows}`,
    `- rawChangedRows: ${report.metrics.rawChangedRows}`,
    `- parsedChangedRows: ${report.metrics.parsedChangedRows}`,
    `- comparableKeyChangedRows: ${report.metrics.comparableKeyChangedRows}`,
    `- poolAffectedRows: ${report.metrics.poolAffectedRows}`,
    "",
    "## Next Comparable Keys",
    "",
    mdTable(["comparableKey", "count"], Object.entries(report.byNextComparableKey)),
    "",
    "## Changed Fields",
    "",
    mdTable(["field", "count"], Object.entries(report.byChangedField)),
    "",
    "## Changed Row Sample",
    "",
    changedRows.length
      ? mdTable(
          ["pid", "title", "rawChanges", "parsedChanges", "currentKey", "nextKey", "pool"],
          changedRows.slice(0, 30).map((row) => [
            row.pid,
            compact(row.title),
            row.rawChangedFields.join(", "),
            row.parsedChangedFields.join(", "),
            row.currentParsed?.comparable_key ?? "",
            row.nextParsed.comparableKey ?? "",
            row.existingPoolStatus ?? "",
          ]),
        )
      : "- none",
    "",
    "## Pool-Affecting Rows",
    "",
    poolAffectedRows.length
      ? mdTable(
          ["pid", "title", "poolStatus", "poolKey", "nextKey"],
          poolAffectedRows.slice(0, 30).map((row) => [
            row.pid,
            compact(row.title),
            row.existingPoolStatus ?? "",
            row.existingPoolComparableKey ?? "",
            row.nextParsed.comparableKey ?? "",
          ]),
        )
      : "- none",
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "headphone-internal-reparse-apply-rehearsal-latest.md"), `${md}\n`);
  console.log(`headphone apply rehearsal: planned=${pids.length}, changed=${changedRows.length}, keyChanged=${comparableKeyChangedRows.length}, poolAffected=${poolAffectedRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
