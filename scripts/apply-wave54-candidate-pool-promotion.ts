import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const reportsDir = path.join(process.cwd(), "reports");
const decisionDir = path.join(process.cwd(), "docs", "DECISIONS");

type Wave54ApplyReport = {
  rows?: Array<{
    lane: string;
    pid: number;
    title: string;
    skuId: string;
    comparableKey: string;
  }>;
};

type RawSnapshot = {
  pid: number;
  name: string | null;
  sku_id: string | null;
  detail_status: string | null;
  listing_state: string | null;
  sale_status: string | null;
  pool_eligible: boolean | null;
  score_dirty: boolean | null;
};

type PoolSnapshot = {
  pid: number;
  status: string | null;
  comparable_key: string | null;
  profit_band: number | null;
};

const applyMode = process.argv.includes("--apply=1");
const rollbackMode = process.argv.includes("--rollback=1");

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional local env file
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchByPid<T>(table: string, select: string, pids: number[]): Promise<Map<number, T>> {
  const rows: T[] = [];
  for (const part of chunk(pids, 80)) {
    const res = await restFetch(`${tableUrl(table)}?select=${select}&pid=in.(${part.join(",")})&limit=${part.length}`, {
      headers: serviceHeaders(),
    });
    if (!res.ok) throw new Error(`${table} fetch failed`);
    rows.push(...((await res.json()) as T[]));
  }
  return new Map(rows.map((row) => [Number((row as { pid: number }).pid), row]));
}

async function patchRawFlags(pids: number[], flags: { pool_eligible: boolean; score_dirty: boolean }) {
  for (const part of chunk(pids, 80)) {
    const res = await restFetch(`${tableUrl("mvp_raw_listings")}?pid=in.(${part.join(",")})`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody(flags),
    });
    if (!res.ok) throw new Error(`mvp_raw_listings flag patch failed`);
  }
}

function validateRows(rows: Wave54ApplyReport["rows"], rawByPid: Map<number, RawSnapshot>) {
  const validationRows = (rows ?? []).map((row) => {
    const raw = rawByPid.get(row.pid);
    const errors = [
      raw ? null : "missing_raw",
      raw?.detail_status === "done" ? null : `detail_status_${raw?.detail_status ?? "missing"}`,
      raw?.listing_state === "active" ? null : `listing_state_${raw?.listing_state ?? "missing"}`,
      String(raw?.sale_status ?? "").toUpperCase() === "SELLING" ? null : `sale_status_${raw?.sale_status ?? "missing"}`,
      raw?.sku_id === row.skuId ? null : `sku_mismatch_${raw?.sku_id ?? "missing"}`,
    ].filter(Boolean) as string[];
    return {
      lane: row.lane,
      pid: row.pid,
      title: row.title,
      skuId: row.skuId,
      comparableKey: row.comparableKey,
      currentPoolEligible: raw?.pool_eligible ?? null,
      currentScoreDirty: raw?.score_dirty ?? null,
      errors,
    };
  });
  return {
    validationRows,
    failedRows: validationRows.filter((row) => row.errors.length > 0).length,
  };
}

async function main() {
  await loadEnvFile(path.join(process.cwd(), ".env.local"));
  await mkdir(reportsDir, { recursive: true });
  await mkdir(decisionDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const sourcePath = path.join(reportsDir, "wave54-cap16-apply-result-latest.json");
  const source = await readJson<Wave54ApplyReport>(sourcePath);
  const rows = source.rows ?? [];
  if (rows.length !== 16) throw new Error(`Expected Wave54 16 rows, got ${rows.length}`);
  if (applyMode && rollbackMode) throw new Error("--apply=1 and --rollback=1 are mutually exclusive");
  if ((applyMode || rollbackMode) && process.env.CANDIDATE_POOL_PROMOTION_APPROVED !== "1") {
    throw new Error("Mutation refused: set CANDIDATE_POOL_PROMOTION_APPROVED=1 after explicit owner approval");
  }

  const pids = rows.map((row) => Number(row.pid)).filter(Number.isFinite);
  const rawBefore = await fetchByPid<RawSnapshot>(
    "mvp_raw_listings",
    "pid,name,sku_id,detail_status,listing_state,sale_status,pool_eligible,score_dirty",
    pids,
  );
  const poolBefore = await fetchByPid<PoolSnapshot>(
    "mvp_candidate_pool",
    "pid,status,comparable_key,profit_band",
    pids,
  );
  const validation = validateRows(rows, rawBefore);
  if (validation.failedRows > 0) {
    console.error(JSON.stringify(validation.validationRows.filter((row) => row.errors.length > 0), null, 2));
    throw new Error(`Validation failed rows=${validation.failedRows}`);
  }

  if (applyMode) {
    await patchRawFlags(pids, { pool_eligible: true, score_dirty: true });
  } else if (rollbackMode) {
    await patchRawFlags(pids, { pool_eligible: false, score_dirty: false });
  }

  const rawAfter = await fetchByPid<RawSnapshot>(
    "mvp_raw_listings",
    "pid,name,sku_id,detail_status,listing_state,sale_status,pool_eligible,score_dirty",
    pids,
  );
  const poolAfter = await fetchByPid<PoolSnapshot>(
    "mvp_candidate_pool",
    "pid,status,comparable_key,profit_band",
    pids,
  );

  const laneCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.lane] = (acc[row.lane] ?? 0) + 1;
    return acc;
  }, {});
  const reportRows = rows.map((row) => {
    const before = rawBefore.get(row.pid);
    const after = rawAfter.get(row.pid);
    return {
      lane: row.lane,
      pid: row.pid,
      title: row.title,
      skuId: row.skuId,
      comparableKey: row.comparableKey,
      poolBefore: poolBefore.get(row.pid) ?? null,
      poolAfter: poolAfter.get(row.pid) ?? null,
      rawBefore: {
        pool_eligible: before?.pool_eligible ?? null,
        score_dirty: before?.score_dirty ?? null,
      },
      rawAfter: {
        pool_eligible: after?.pool_eligible ?? null,
        score_dirty: after?.score_dirty ?? null,
      },
    };
  });
  const report = {
    generatedAt,
    scope: "wave54_candidate_pool_public_pilot",
    mode: applyMode ? "apply" : rollbackMode ? "rollback" : "dry_run",
    source: "reports/wave54-cap16-apply-result-latest.json",
    mutation: applyMode || rollbackMode,
    strategy: "set mvp_raw_listings.pool_eligible=true and score_dirty=true; existing scoreStage/candidate-pool builder owns final candidate_pool admission",
    metrics: {
      rows: rows.length,
      lanes: Object.keys(laneCounts).length,
      laneCounts,
      validationFailedRows: validation.failedRows,
      candidatePoolRowsBefore: [...poolBefore.values()].length,
      candidatePoolRowsAfter: [...poolAfter.values()].length,
      poolEligibleTrueAfter: [...rawAfter.values()].filter((row) => row.pool_eligible === true).length,
      scoreDirtyTrueAfter: [...rawAfter.values()].filter((row) => row.score_dirty === true).length,
    },
    rows: reportRows,
    next: applyMode
      ? [
          "Run /api/cron/tick?wait=1 once or wait for scheduled tick.",
          "Regenerate pack-open-quality and db-hotpaths.",
          "Check target pids in mvp_candidate_pool; skipped rows should show normal pool-policy reasons.",
        ]
      : rollbackMode
        ? ["Verify target pids no longer enter candidate_pool from this promotion wave."]
        : ["Apply with CANDIDATE_POOL_PROMOTION_APPROVED=1 npx tsx scripts/apply-wave54-candidate-pool-promotion.ts --apply=1"],
  };

  const jsonPath = path.join(reportsDir, "wave54-candidate-pool-promotion-latest.json");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const mdRows = reportRows.map((row) =>
    `| ${row.lane} | ${row.pid} | ${row.skuId} | ${row.rawBefore.pool_eligible}/${row.rawBefore.score_dirty} | ${row.rawAfter.pool_eligible}/${row.rawAfter.score_dirty} | ${row.poolBefore ? "yes" : "no"} | ${row.poolAfter ? "yes" : "no"} | ${row.title.replace(/\|/g, "/")} |`,
  );
  const md = [
    "# Wave54 Candidate Pool Promotion",
    "",
    `- generatedAt: ${generatedAt}`,
    `- mode: ${report.mode}`,
    `- mutation: ${report.mutation}`,
    `- strategy: ${report.strategy}`,
    "",
    "## Metrics",
    "",
    `- rows: ${report.metrics.rows}`,
    `- lanes: ${report.metrics.lanes}`,
    `- laneCounts: ${JSON.stringify(report.metrics.laneCounts)}`,
    `- validationFailedRows: ${report.metrics.validationFailedRows}`,
    `- candidatePoolRowsBefore/After: ${report.metrics.candidatePoolRowsBefore}/${report.metrics.candidatePoolRowsAfter}`,
    `- poolEligibleTrueAfter: ${report.metrics.poolEligibleTrueAfter}`,
    `- scoreDirtyTrueAfter: ${report.metrics.scoreDirtyTrueAfter}`,
    "",
    "## Rows",
    "",
    "| lane | pid | sku | raw before pool/dirty | raw after pool/dirty | pool before | pool after | title |",
    "| --- | ---: | --- | --- | --- | --- | --- | --- |",
    ...mdRows,
    "",
    "## Next",
    "",
    ...report.next.map((line) => `- ${line}`),
  ].join("\n");
  await writeFile(jsonPath.replace(/\.json$/, ".md"), `${md}\n`);
  if (applyMode) {
    await writeFile(
      path.join(decisionDir, "2026-05-14-wave54-candidate-pool-promotion.md"),
      [
        "# Wave54 Candidate Pool Promotion",
        "",
        `- generatedAt: ${generatedAt}`,
        "- decision: owner requested aggressive MVP exposure for deterministic/high-confidence Wave54 rows.",
        "- action: set pool_eligible=true and score_dirty=true for 16 Wave54 rows; candidate_pool admission remains owned by existing scoreStage/pool policy.",
        "- public category readiness: unchanged.",
        "- direct candidate_pool insert: 0.",
        "- rollback: rerun this script with --rollback=1 and approval env.",
        "",
        `Report: reports/${path.basename(jsonPath)}`,
      ].join("\n"),
    );
  }
  console.log(`wave54 candidate promotion ${report.mode}: rows=${report.metrics.rows}, poolEligibleTrueAfter=${report.metrics.poolEligibleTrueAfter}, scoreDirtyTrueAfter=${report.metrics.scoreDirtyTrueAfter}, poolRowsAfter=${report.metrics.candidatePoolRowsAfter}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
