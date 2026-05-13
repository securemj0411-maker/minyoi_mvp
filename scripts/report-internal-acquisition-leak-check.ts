import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type DryRun = {
  mode: "dry_run" | "apply";
  runtimeMutation: boolean;
  supabaseMutation: boolean;
  publicPromotion: boolean;
  candidatePoolWrites: number;
  rows: Array<{
    lane: string;
    pid: number;
    title: string;
    price: number;
    skuId: string;
    comparableKey: string;
    validationErrors: string[];
  }>;
};

type RawSnapshot = {
  pid: number;
  name: string | null;
  price: number | null;
  listing_type: string | null;
  sku_id: string | null;
  sku_name: string | null;
  detail_status: string | null;
  listing_state: string | null;
  sale_status: string | null;
  pool_eligible?: boolean | null;
  score_dirty?: boolean | null;
  updated_at: string | null;
};

type ParsedSnapshot = {
  pid: number;
  comparable_key: string | null;
  needs_review: boolean | null;
  parse_confidence: number | null;
  updated_at: string | null;
};

type PoolSnapshot = {
  pid: number;
  status: string | null;
  comparable_key: string | null;
  profit_band: number | null;
  updated_at: string | null;
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

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, relativePath), "utf8")) as T;
}

async function restJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`${url} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function fetchByPid<T>(table: string, select: string, pids: number[]) {
  const rows: T[] = [];
  for (const chunk of chunks(pids, 80)) {
    rows.push(...await restJson<T[]>(`${tableUrl(table)}?select=${select}&pid=in.(${chunk.join(",")})&limit=${chunk.length}`));
  }
  return rows;
}

async function fetchRawSnapshots(pids: number[]) {
  const fullSelect = "pid,name,price,listing_type,sku_id,sku_name,detail_status,listing_state,sale_status,pool_eligible,score_dirty,updated_at";
  try {
    return {
      rows: await fetchByPid<RawSnapshot>("mvp_raw_listings", fullSelect, pids),
      poolEligibleSelectable: true,
      scoreDirtySelectable: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/pool_eligible|score_dirty|42703/i.test(message)) throw err;
    const fallbackSelect = "pid,name,price,listing_type,sku_id,sku_name,detail_status,listing_state,sale_status,updated_at";
    return {
      rows: await fetchByPid<RawSnapshot>("mvp_raw_listings", fallbackSelect, pids),
      poolEligibleSelectable: !/pool_eligible/i.test(message),
      scoreDirtySelectable: !/score_dirty/i.test(message),
    };
  }
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function compact(text: unknown, limit = 80) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function mdTable(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "_none_";
  const headers = Object.keys(rows[0]);
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${headers.map((header) => String(row[header] ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const dryRun = await readJson<DryRun>("reports/internal-acquisition-executor-dry-run-latest.json");
  if (dryRun.mode !== "dry_run" || dryRun.runtimeMutation || dryRun.supabaseMutation || dryRun.publicPromotion || dryRun.candidatePoolWrites !== 0) {
    throw new Error("Refusing leak check: source executor report is not a no-write dry run");
  }

  const pids = [...new Set(dryRun.rows.map((row) => Number(row.pid)).filter(Number.isFinite))];
  const [rawResult, parsedRows, poolRows] = await Promise.all([
    fetchRawSnapshots(pids),
    fetchByPid<ParsedSnapshot>("mvp_listing_parsed", "pid,comparable_key,needs_review,parse_confidence,updated_at", pids),
    fetchByPid<PoolSnapshot>("mvp_candidate_pool", "pid,status,comparable_key,profit_band,updated_at", pids),
  ]);
  const rawRows = rawResult.rows;

  const rawByPid = new Map(rawRows.map((row) => [row.pid, row]));
  const parsedByPid = new Map(parsedRows.map((row) => [row.pid, row]));
  const poolByPid = new Map(poolRows.map((row) => [row.pid, row]));

  const checkedRows = dryRun.rows.map((row) => {
    const raw = rawByPid.get(row.pid) ?? null;
    const parsed = parsedByPid.get(row.pid) ?? null;
    const pool = poolByPid.get(row.pid) ?? null;
    const findings = [
      pool ? `candidate_pool_row_exists:${pool.status ?? "unknown"}` : null,
      rawResult.poolEligibleSelectable ? null : "schema_missing_pool_eligible",
      rawResult.scoreDirtySelectable ? null : "schema_missing_score_dirty",
      raw?.pool_eligible === true ? "existing_raw_pool_eligible_true" : null,
      raw?.listing_state && raw.listing_state !== "active" ? `existing_raw_state_${raw.listing_state}` : null,
      raw?.listing_type && raw.listing_type !== "normal" ? `existing_raw_listing_type_${raw.listing_type}` : null,
      raw?.sku_id && raw.sku_id !== row.skuId ? `existing_raw_sku_mismatch:${raw.sku_id}` : null,
      parsed?.comparable_key && parsed.comparable_key !== row.comparableKey ? `existing_parsed_key_mismatch:${parsed.comparable_key}` : null,
      parsed?.needs_review === true ? "existing_parsed_needs_review_true" : null,
    ].filter((item): item is string => Boolean(item));

    return {
      lane: row.lane,
      pid: row.pid,
      title: row.title,
      skuId: row.skuId,
      comparableKey: row.comparableKey,
      existingRaw: Boolean(raw),
      existingParsed: Boolean(parsed),
      existingPool: Boolean(pool),
      existingPoolStatus: pool?.status ?? null,
      rawPoolEligible: raw?.pool_eligible ?? null,
      rawScoreDirty: raw?.score_dirty ?? null,
      findings,
    };
  });

  const hardIssues = checkedRows.filter((row) => row.existingPool || row.rawPoolEligible === true);
  const softIssues = checkedRows.filter((row) => row.findings.length > 0 && !hardIssues.includes(row));
  const okRows = checkedRows.filter((row) => row.findings.length === 0);
  const schemaReady = rawResult.poolEligibleSelectable && rawResult.scoreDirtySelectable;
  const report = {
    generatedAt,
    scope: "internal_acquisition_no_write_leak_check",
    reportOnly: true,
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    candidatePoolWrites: 0,
    metrics: {
      proposedRows: checkedRows.length,
      existingRawRows: rawRows.length,
      existingParsedRows: parsedRows.length,
      existingCandidatePoolRows: poolRows.length,
      poolEligibleSelectable: rawResult.poolEligibleSelectable,
      scoreDirtySelectable: rawResult.scoreDirtySelectable,
      hardIssueRows: hardIssues.length,
      softIssueRows: softIssues.length,
      okRows: okRows.length,
    },
    byLane: countBy(checkedRows, (row) => row.lane),
    findingsByReason: countBy(checkedRows.flatMap((row) => row.findings), (reason) => reason),
    hardIssues,
    softIssues,
    rows: checkedRows,
    decision: !schemaReady
      ? "hold_apply_pool_eligibility_schema_missing"
      : hardIssues.length === 0
        ? "no_candidate_pool_leak_detected_apply_still_requires_owner_approval_and_fresh_refetch"
        : "hold_apply_candidate_pool_or_pool_eligible_leak_detected",
  };

  await writeFile(path.join(reportsDir, "internal-acquisition-leak-check-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  const issueRows = [...hardIssues, ...softIssues].slice(0, 30).map((row) => ({
    lane: row.lane,
    pid: row.pid,
    existingPool: row.existingPool,
    rawPoolEligible: row.rawPoolEligible,
    findings: row.findings.join("; ") || "ok",
    title: compact(row.title),
  }));
  const md = [
    "# Internal Acquisition Leak Check",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly/runtimeMutation/supabaseMutation/publicPromotion: true/false/false/false",
    `- decision: ${report.decision}`,
    "",
    "## Metrics",
    "",
    `- proposedRows: ${report.metrics.proposedRows}`,
    `- existingRawRows: ${report.metrics.existingRawRows}`,
    `- existingParsedRows: ${report.metrics.existingParsedRows}`,
    `- existingCandidatePoolRows: ${report.metrics.existingCandidatePoolRows}`,
    `- poolEligibleSelectable: ${report.metrics.poolEligibleSelectable}`,
    `- scoreDirtySelectable: ${report.metrics.scoreDirtySelectable}`,
    `- hardIssueRows: ${report.metrics.hardIssueRows}`,
    `- softIssueRows: ${report.metrics.softIssueRows}`,
    `- okRows: ${report.metrics.okRows}`,
    "",
    "## Findings By Reason",
    "",
    "```json",
    JSON.stringify(report.findingsByReason, null, 2),
    "```",
    "",
    "## Issue Rows",
    "",
    mdTable(issueRows),
    "",
    "## Decision",
    "",
    !schemaReady
      ? "- Hold actual apply. Production DB does not expose the pool eligibility columns required for safe internal-only acquisition."
      : hardIssues.length === 0
      ? "- Candidate pool leak was not detected. Actual apply is still blocked until explicit owner approval and same-request fresh detail refetch."
      : "- Hold actual apply. Resolve candidate pool / pool_eligible leaks before any DB write.",
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "internal-acquisition-leak-check-latest.md"), md);
  console.log(JSON.stringify(report.metrics));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
