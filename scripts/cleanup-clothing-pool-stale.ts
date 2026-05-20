import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { evaluatePoolGate } from "@/lib/candidate-pool-builder";
import { ruleMatch, skuById, type Sku } from "@/lib/catalog";
import { CATEGORY_READINESS, LANE_READINESS } from "@/lib/category-readiness";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const DEFAULT_STATUSES = ["ready", "reserved"];
const PATCH_CHUNK_SIZE = 80;

type PoolRow = {
  pid: number;
  status: string | null;
  category: string | null;
  comparable_key: string | null;
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
  sale_status: string | null;
};

type CleanupCandidate = {
  pid: number;
  status: string | null;
  title: string | null;
  price: number | null;
  rawSkuId: string | null;
  currentSkuId: string | null;
  laneKey: string | null;
  reason: string;
  profitMin: number | null;
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

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
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

function effectiveClothingSku(row: Pick<RawRow, "sku_id" | "name" | "description_preview">): Sku | null {
  const stored = row.sku_id ? skuById(row.sku_id) ?? null : null;
  if (stored?.category === "clothing" || row.sku_id?.startsWith("clothing-")) {
    return ruleMatch(row.name ?? "", row.description_preview ?? "") ?? null;
  }
  return stored ?? ruleMatch(row.name ?? "", row.description_preview ?? "") ?? null;
}

function summarizeBy<T extends string | null>(items: CleanupCandidate[], selector: (item: CleanupCandidate) => T) {
  const out: Record<string, number> = {};
  for (const item of items) {
    const key = selector(item) ?? "(null)";
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

async function patchInvalidated(candidates: CleanupCandidate[], statuses: string[]) {
  const updatedAt = new Date().toISOString();
  const byReason = new Map<string, number[]>();
  for (const candidate of candidates) {
    const pids = byReason.get(candidate.reason) ?? [];
    pids.push(candidate.pid);
    byReason.set(candidate.reason, pids);
  }
  for (const [reason, pids] of byReason.entries()) {
    for (const part of chunk(pids, PATCH_CHUNK_SIZE)) {
      await restFetch(
        `${tableUrl("mvp_candidate_pool")}?pid=in.${inList(part)}&status=in.(${statuses.join(",")})`,
        {
          method: "PATCH",
          headers: serviceHeaders("return=minimal"),
          body: jsonBody({
            status: "invalidated",
            invalidated_reason: reason.slice(0, 120),
            reserved_until: null,
            updated_at: updatedAt,
          }),
        },
      );
    }
  }
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const apply = hasFlag("apply");
  const statuses = arg("statuses", DEFAULT_STATUSES.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const limit = Number(arg("limit", "5000"));
  const applyLimit = Number(arg("apply-limit", "0"));
  const reasonPrefix = arg("reason-prefix", "wave408_");

  if (statuses.some((status) => !["ready", "reserved"].includes(status))) {
    throw new Error(`Only ready/reserved cleanup is supported, got: ${statuses.join(",")}`);
  }

  const poolRows = await fetchJson<PoolRow>(
    `${tableUrl("mvp_candidate_pool")}?select=pid,status,category,comparable_key,expected_profit_min,expected_profit_max&category=eq.clothing&status=in.(${statuses.join(",")})&order=expected_profit_min.desc&limit=${limit}`,
  );
  const pids = [...new Set(poolRows.map((row) => Number(row.pid)).filter(Number.isFinite))];
  const rawRows: RawRow[] = [];
  for (const part of chunk(pids, 200)) {
    rawRows.push(...await fetchJson<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sku_name,name,price,description_preview,sale_status&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }

  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const candidates: CleanupCandidate[] = [];
  for (const pool of poolRows) {
    const pid = Number(pool.pid);
    const raw = rawByPid.get(pid);
    const sku = raw ? effectiveClothingSku(raw) : null;
    const decision = evaluatePoolGate(
      { sku, category: "clothing" },
      { categoryReadiness: CATEGORY_READINESS, laneReadiness: LANE_READINESS },
    );
    if (decision.canEnterPool) continue;
    const baseReason = raw ? decision.reason : "missing_raw_row";
    candidates.push({
      pid,
      status: pool.status,
      title: raw?.name ?? null,
      price: raw?.price ?? null,
      rawSkuId: raw?.sku_id ?? null,
      currentSkuId: sku?.id ?? null,
      laneKey: sku?.laneKey ?? null,
      reason: `${reasonPrefix}${baseReason}`.slice(0, 120),
      profitMin: pool.expected_profit_min,
    });
  }

  const selected = apply && applyLimit > 0 ? candidates.slice(0, applyLimit) : candidates;
  if (apply && selected.length > 0) {
    await patchInvalidated(selected, statuses);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    statuses,
    scannedRows: poolRows.length,
    candidateRows: candidates.length,
    selectedRows: selected.length,
    byStatus: summarizeBy(candidates, (item) => item.status),
    byReason: summarizeBy(candidates, (item) => item.reason),
    byLane: summarizeBy(candidates, (item) => item.laneKey ?? item.currentSkuId ?? item.rawSkuId),
    applied: apply,
    samples: candidates.slice(0, 30),
  };

  const suffix = apply ? "apply" : "dry-run";
  const jsonPath = path.join(reportsDir, `clothing-pool-cleanup-${suffix}-latest.json`);
  const mdPath = path.join(reportsDir, `clothing-pool-cleanup-${suffix}-latest.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, [
    "# Clothing Pool Cleanup",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    "",
    "## Totals",
    `- scannedRows: ${report.scannedRows}`,
    `- candidateRows: ${report.candidateRows}`,
    `- selectedRows: ${report.selectedRows}`,
    `- applied: ${report.applied ? "yes" : "no"}`,
    "",
    "## By Status",
    ...Object.entries(report.byStatus).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## By Reason",
    ...Object.entries(report.byReason).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Samples",
    ...report.samples.slice(0, 20).map((row) => `- pid ${row.pid}: ${row.title} / status=${row.status} / current=${row.currentSkuId ?? "null"} / reason=${row.reason}`),
    "",
  ].join("\n"));

  console.log(JSON.stringify({
    jsonPath,
    mdPath,
    totals: {
      mode: report.mode,
      scannedRows: report.scannedRows,
      candidateRows: report.candidateRows,
      selectedRows: report.selectedRows,
      applied: report.applied,
      byStatus: report.byStatus,
      topReasons: Object.entries(report.byReason).slice(0, 12),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
