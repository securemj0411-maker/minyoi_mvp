import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { hardSplitChipSignature, shouldUseExactHardChipComparison, summarizeConditionChips } from "@/lib/condition-chip-policy";
import { mergeConditionDisplayChips } from "@/lib/condition-display";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

type PoolRow = {
  pid: number;
  status: string | null;
  category: string | null;
  comparable_key: string | null;
  condition_class: string | null;
  expected_profit_min: number | null;
  expected_profit_max: number | null;
  last_verified_at: string | null;
};

type RawRow = {
  pid: number;
  name: string | null;
  price: number | null;
  source: string | null;
  seller_source: string | null;
  sale_status: string | null;
  listing_state: string | null;
  description_preview: string | null;
  url: string | null;
};

type ParsedRow = {
  pid: number;
  comparable_key: string | null;
  condition_class: string | null;
  condition_tier: string | null;
  condition_notes: string[] | null;
  parsed_json: Record<string, unknown> | null;
};

type AuditedRow = {
  pid: number;
  title: string;
  source: string | null;
  category: string | null;
  status: string | null;
  price: number | null;
  profit: number | null;
  comparableKey: string | null;
  conditionClass: string | null;
  conditionTier: string | null;
  chips: string[];
  hardSplit: string[];
  softAdjustment: string[];
  premiumSignal: string[];
  hardSignature: string;
  groupKey: string;
  chipGroupKey: string;
  suspiciousHighGrade: boolean;
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

async function fetchRawRows(pids: number[]) {
  const rows: RawRow[] = [];
  const select = "pid,name,price,source,seller_source,sale_status,listing_state,description_preview,url";
  for (const part of chunk([...new Set(pids)], 400)) {
    rows.push(...await restJson<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=${select}&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

async function fetchParsedRows(pids: number[]) {
  const rows: ParsedRow[] = [];
  const select = "pid,comparable_key,condition_class,condition_tier,condition_notes,parsed_json";
  for (const part of chunk([...new Set(pids)], 400)) {
    rows.push(...await restJson<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=${select}&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

function countBy<T>(rows: T[], keyFn: (row: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyFn(row) || "(null)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function mdTable(headers: string[], rows: unknown[][]) {
  const clean = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  return [
    `| ${headers.map(clean).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(clean).join(" | ")} |`),
  ].join("\n");
}

function conditionGradeChips(parsedJson: Record<string, unknown> | null | undefined) {
  const grade = parsedJson?.condition_grade as { chips?: unknown } | null | undefined;
  return grade?.chips ?? null;
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function groupKey(row: PoolRow, parsed?: ParsedRow | null) {
  return [
    row.category ?? parsed?.parsed_json?.category ?? "unknown_category",
    row.comparable_key ?? parsed?.comparable_key ?? "unknown_key",
    row.condition_class ?? parsed?.condition_class ?? "unknown_class",
    parsed?.condition_tier ?? "no_tier",
  ].join("::");
}

function titleOf(raw: RawRow | undefined, max = 80) {
  const title = raw?.name ?? "";
  return title.length > max ? `${title.slice(0, max - 1)}…` : title;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const limit = Number(arg("limit", "5000"));
  const statuses = arg("statuses", "ready,reserved").split(",").map((item) => item.trim()).filter(Boolean);
  const categoriesArg = arg("categories", "all").split(",").map((item) => item.trim()).filter(Boolean);
  const categoryClause = categoriesArg.includes("all") ? "" : `&category=in.(${categoriesArg.join(",")})`;
  const poolSelect = "pid,status,category,comparable_key,condition_class,expected_profit_min,expected_profit_max,last_verified_at";
  const poolRows = await fetchAll<PoolRow>(
    `${tableUrl("mvp_candidate_pool")}?select=${poolSelect}&status=in.(${statuses.join(",")})${categoryClause}`,
    limit,
    "last_verified_at.desc.nullslast",
  );
  const pids = poolRows.map((row) => Number(row.pid)).filter(Number.isFinite);
  const [rawRows, parsedRows] = await Promise.all([
    fetchRawRows(pids),
    fetchParsedRows(pids),
  ]);
  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));

  const auditedRows: AuditedRow[] = poolRows.map((pool) => {
    const pid = Number(pool.pid);
    const raw = rawByPid.get(pid);
    const parsed = parsedByPid.get(pid);
    const parsedJsonNotes = asArray(parsed?.parsed_json?.condition_notes);
    const chips = mergeConditionDisplayChips(
      conditionGradeChips(parsed?.parsed_json),
      parsed?.condition_notes ?? parsedJsonNotes,
    ) ?? [];
    const summary = summarizeConditionChips(chips);
    const signature = hardSplitChipSignature(chips);
    const baseGroupKey = groupKey(pool, parsed);
    const conditionClass = pool.condition_class ?? parsed?.condition_class ?? null;
    const conditionTier = parsed?.condition_tier ?? null;
    const highCondition = (
      conditionClass === "unopened" ||
      conditionClass === "mint" ||
      conditionClass === "clean" ||
      conditionTier === "S" ||
      conditionTier === "A"
    );
    return {
      pid,
      title: titleOf(raw),
      source: raw?.source ?? raw?.seller_source ?? null,
      category: pool.category ?? null,
      status: pool.status ?? null,
      price: raw?.price ?? null,
      profit: pool.expected_profit_max ?? pool.expected_profit_min ?? null,
      comparableKey: pool.comparable_key ?? parsed?.comparable_key ?? null,
      conditionClass,
      conditionTier,
      chips,
      hardSplit: summary.hardSplit,
      softAdjustment: summary.softAdjustment,
      premiumSignal: summary.premiumSignal,
      hardSignature: signature,
      groupKey: baseGroupKey,
      chipGroupKey: `${baseGroupKey}::${signature || "no_hard_chip"}`,
      suspiciousHighGrade: highCondition && (summary.hardSplit.length > 0 || summary.softAdjustment.length > 0),
    };
  });

  const groupCounts = new Map<string, number>();
  const chipGroupCounts = new Map<string, number>();
  for (const row of auditedRows) {
    groupCounts.set(row.groupKey, (groupCounts.get(row.groupKey) ?? 0) + 1);
    chipGroupCounts.set(row.chipGroupKey, (chipGroupCounts.get(row.chipGroupKey) ?? 0) + 1);
  }

  const rowsWithChips = auditedRows.filter((row) => row.chips.length > 0);
  const hardRows = auditedRows.filter((row) => row.hardSplit.length > 0);
  const softRows = auditedRows.filter((row) => row.softAdjustment.length > 0);
  const premiumRows = auditedRows.filter((row) => row.premiumSignal.length > 0);
  const suspiciousRows = auditedRows.filter((row) => row.suspiciousHighGrade);
  const exactChipSparseRows = hardRows.filter((row) => {
    const gate = shouldUseExactHardChipComparison({
      sameConditionSamples: groupCounts.get(row.groupKey) ?? 0,
      sameHardChipSamples: chipGroupCounts.get(row.chipGroupKey) ?? 0,
    });
    return !gate.ok;
  });
  const exactChipReadyRows = hardRows.filter((row) => {
    const gate = shouldUseExactHardChipComparison({
      sameConditionSamples: groupCounts.get(row.groupKey) ?? 0,
      sameHardChipSamples: chipGroupCounts.get(row.chipGroupKey) ?? 0,
    });
    return gate.ok;
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    mutation: false,
    scope: {
      statuses,
      categories: categoriesArg,
      limit,
      poolRows: poolRows.length,
    },
    metrics: {
      poolRows: auditedRows.length,
      rowsWithChips: rowsWithChips.length,
      rowsWithChipsRate: pct(rowsWithChips.length, auditedRows.length),
      hardSplitRows: hardRows.length,
      hardSplitRate: pct(hardRows.length, auditedRows.length),
      softAdjustmentRows: softRows.length,
      softAdjustmentRate: pct(softRows.length, auditedRows.length),
      premiumSignalRows: premiumRows.length,
      premiumSignalRate: pct(premiumRows.length, auditedRows.length),
      suspiciousHighGradeRows: suspiciousRows.length,
      exactHardChipSparseRows: exactChipSparseRows.length,
      exactHardChipReadyRows: exactChipReadyRows.length,
    },
    byCategory: countBy(auditedRows, (row) => row.category),
    hardByCategory: countBy(hardRows, (row) => row.category),
    softByCategory: countBy(softRows, (row) => row.category),
    bySource: countBy(auditedRows, (row) => row.source),
    hardBySource: countBy(hardRows, (row) => row.source),
    hardChipCounts: countBy(hardRows.flatMap((row) => row.hardSplit.map((chip) => ({ chip }))), (row) => row.chip),
    softChipCounts: countBy(softRows.flatMap((row) => row.softAdjustment.map((chip) => ({ chip }))), (row) => row.chip),
    premiumChipCounts: countBy(premiumRows.flatMap((row) => row.premiumSignal.map((chip) => ({ chip }))), (row) => row.chip),
    hardSamples: hardRows
      .sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0))
      .slice(0, 40),
    suspiciousSamples: suspiciousRows
      .sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0))
      .slice(0, 40),
    exactChipSparseSamples: exactChipSparseRows
      .sort((a, b) => (groupCounts.get(b.groupKey) ?? 0) - (groupCounts.get(a.groupKey) ?? 0))
      .slice(0, 40)
      .map((row) => ({
        ...row,
        sameConditionSamples: groupCounts.get(row.groupKey) ?? 0,
        sameHardChipSamples: chipGroupCounts.get(row.chipGroupKey) ?? 0,
      })),
    recommendation: [
      "Do not enable exact chip-set comparison globally while exactHardChipSparseRows is non-zero.",
      "Hard split chips are safe as an audit and exclusion axis first; exact grouping should require same-condition and same-hard-chip sample thresholds.",
      "Soft adjustment and premium signal chips should stay as display/penalty/premium evidence until per-SKU density is proven.",
      "Rows with suspiciousHighGradeRows should feed the ambiguity/AI audit queue, not immediate bulk invalidation.",
    ],
  };

  await writeFile(path.join(reportsDir, "condition-chip-policy-audit-latest.json"), `${JSON.stringify(report, null, 2)}\n`);

  const metricsTable = mdTable(["metric", "value"], Object.entries(report.metrics));
  const hardChipTable = mdTable(["hard chip", "count"], report.hardChipCounts.map((row) => [row.key, row.count]));
  const softChipTable = mdTable(["soft chip", "count"], report.softChipCounts.map((row) => [row.key, row.count]));
  const sparseTable = mdTable(
    ["pid", "category", "source", "title", "condition samples", "same hard-chip samples", "hard chips"],
    report.exactChipSparseSamples.slice(0, 25).map((row) => [
      row.pid,
      row.category ?? "",
      row.source ?? "",
      row.title,
      row.sameConditionSamples,
      row.sameHardChipSamples,
      row.hardSplit.join(", "),
    ]),
  );
  const md = [
    "# Condition Chip Policy Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "No-write audit over ready/reserved candidate_pool rows. Measures whether condition chips are dense enough to become a comparison axis.",
    "",
    "## Metrics",
    "",
    metricsTable,
    "",
    "## Hard Chips",
    "",
    hardChipTable,
    "",
    "## Soft Chips",
    "",
    softChipTable,
    "",
    "## Exact Hard Chip Sparse Samples",
    "",
    sparseTable,
    "",
    "## Recommendation",
    "",
    ...report.recommendation.map((line) => `- ${line}`),
  ].join("\n");
  await writeFile(path.join(reportsDir, "condition-chip-policy-audit-latest.md"), `${md}\n`);

  console.log(JSON.stringify({
    generatedAt: report.generatedAt,
    metrics: report.metrics,
    hardChipCounts: report.hardChipCounts,
    softChipCounts: report.softChipCounts,
    reportJson: "reports/condition-chip-policy-audit-latest.json",
    reportMd: "reports/condition-chip-policy-audit-latest.md",
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
