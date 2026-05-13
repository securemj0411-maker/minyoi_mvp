import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type LeakCheck = {
  metrics: {
    existingCandidatePoolRows: number;
    hardIssueRows: number;
  };
  hardIssues: Array<{
    lane: string;
    pid: number;
    title: string;
    findings: string[];
  }>;
  rows: Array<{
    lane: string;
    pid: number;
    title: string;
    skuId: string;
    comparableKey: string;
    existingRaw: boolean;
    existingParsed: boolean;
    existingPool: boolean;
    existingPoolStatus: string | null;
    findings: string[];
  }>;
};

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, relativePath), "utf8")) as T;
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function compact(text: unknown, limit = 90) {
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

function classifyConflict(row: LeakCheck["rows"][number]) {
  if (row.existingPool) return "pool_artifact_separate_cleanup";
  if (row.findings.some((finding) => /sku_mismatch|parsed_key_mismatch/.test(finding))) return "raw_parsed_refresh_allowed_after_fresh_refetch";
  if (row.existingRaw || row.existingParsed) return "idempotent_update_candidate";
  return "new_internal_acquisition_candidate";
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const leak = await readJson<LeakCheck>("reports/internal-acquisition-leak-check-latest.json");
  const rows = leak.rows.map((row) => ({
    ...row,
    policy: classifyConflict(row),
  }));
  const poolArtifacts = rows.filter((row) => row.policy === "pool_artifact_separate_cleanup");
  const refreshAllowed = rows.filter((row) => row.policy === "raw_parsed_refresh_allowed_after_fresh_refetch");
  const idempotent = rows.filter((row) => row.policy === "idempotent_update_candidate");
  const freshNew = rows.filter((row) => row.policy === "new_internal_acquisition_candidate");
  const report = {
    generatedAt,
    scope: "internal_acquisition_conflict_policy",
    reportOnly: true,
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    candidatePoolWrites: 0,
    metrics: {
      totalRows: rows.length,
      poolArtifactRows: poolArtifacts.length,
      refreshAllowedRows: refreshAllowed.length,
      idempotentUpdateRows: idempotent.length,
      newInternalRows: freshNew.length,
    },
    byPolicy: countBy(rows, (row) => row.policy),
    byLanePolicy: countBy(rows, (row) => `${row.lane}:${row.policy}`),
    policy: {
      pool_artifact_separate_cleanup:
        "Do not mutate candidate_pool during internal acquisition. Existing invalidated rows are historical public-pool artifacts and need a separate cleanup/rebuild decision.",
      raw_parsed_refresh_allowed_after_fresh_refetch:
        "After pool eligibility migration, internal executor may refresh raw/parsed only if same-request fresh detail confirms active clean, stable new sku/comparable key, and writes pool_eligible=false.",
      idempotent_update_candidate:
        "Existing raw/parsed rows can be updated by the internal executor only under the same fresh-refetch guard.",
      new_internal_acquisition_candidate:
        "New rows can be inserted internally after migration and fresh-refetch, with pool_eligible=false and score_dirty=false.",
    },
    rows,
    decision:
      poolArtifacts.length > 0
        ? "split_candidate_pool_artifacts_from_internal_acquisition_apply"
        : "no_candidate_pool_conflict_internal_apply_can_remain_schema_gated",
  };

  await writeFile(path.join(reportsDir, "internal-acquisition-conflict-policy-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    "# Internal Acquisition Conflict Policy",
    "",
    `- generatedAt: ${generatedAt}`,
    `- decision: ${report.decision}`,
    "- reportOnly/runtimeMutation/supabaseMutation/publicPromotion: true/false/false/false",
    "",
    "## Metrics",
    "",
    `- totalRows: ${report.metrics.totalRows}`,
    `- poolArtifactRows: ${report.metrics.poolArtifactRows}`,
    `- refreshAllowedRows: ${report.metrics.refreshAllowedRows}`,
    `- idempotentUpdateRows: ${report.metrics.idempotentUpdateRows}`,
    `- newInternalRows: ${report.metrics.newInternalRows}`,
    "",
    "## By Policy",
    "",
    "```json",
    JSON.stringify(report.byPolicy, null, 2),
    "```",
    "",
    "## Policy",
    "",
    ...Object.entries(report.policy).map(([key, value]) => `- \`${key}\`: ${value}`),
    "",
    "## Pool Artifact Rows",
    "",
    mdTable(poolArtifacts.map((row) => ({
      lane: row.lane,
      pid: row.pid,
      poolStatus: row.existingPoolStatus,
      findings: row.findings.join("; "),
      title: compact(row.title),
    }))),
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "internal-acquisition-conflict-policy-latest.md"), md);
  console.log(JSON.stringify(report.metrics));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
