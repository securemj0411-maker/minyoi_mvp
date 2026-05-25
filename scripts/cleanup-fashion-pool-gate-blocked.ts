import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { evaluatePoolGate } from "@/lib/candidate-pool-builder";
import { ruleMatch, type Sku } from "@/lib/catalog";
import { CATEGORY_READINESS, LANE_READINESS } from "@/lib/category-readiness";
import { parseListingOptions } from "@/lib/option-parser";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const PATCH_CHUNK_SIZE = 80;

type PoolRow = {
  pid: number;
  status: string | null;
  category: string | null;
  comparable_key: string | null;
  expected_profit_min: number | null;
};

type RawRow = {
  pid: number;
  sku_id: string | null;
  name: string | null;
  price: number | null;
  description_preview: string | null;
  bunjang_condition_label: string | null;
};

type CleanupCandidate = {
  pid: number;
  status: string | null;
  category: string | null;
  title: string | null;
  rawSkuId: string | null;
  currentSkuId: string | null;
  currentCategory: string | null;
  poolKey: string | null;
  currentKey: string | null;
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
  const categories = arg("categories", "shoe,clothing,bag").split(",").map((item) => item.trim()).filter(Boolean);
  const statuses = arg("statuses", "ready,reserved").split(",").map((item) => item.trim()).filter(Boolean);
  const includeKeyDrift = hasFlag("include-key-drift");
  const extraPids = arg("extra-pids", "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter(Number.isFinite);
  const extraReason = arg("extra-reason", "wave410_manual_extra_pool_cleanup").slice(0, 120);

  const poolRows = await fetchJson<PoolRow>(
    `${tableUrl("mvp_candidate_pool")}?select=pid,status,category,comparable_key,expected_profit_min&category=in.(${categories.join(",")})&status=in.(${statuses.join(",")})&order=expected_profit_min.desc&limit=5000`,
  );
  const pids = [...new Set(poolRows.map((row) => Number(row.pid)).filter(Number.isFinite))];
  const rawRows: RawRow[] = [];
  for (const part of chunk(pids, 200)) {
    rawRows.push(...await fetchJson<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,name,price,description_preview,bunjang_condition_label&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }

  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const candidates: CleanupCandidate[] = [];
  for (const pool of poolRows) {
    const pid = Number(pool.pid);
    const raw = rawByPid.get(pid);
    const currentSku = raw ? ruleMatch(raw.name ?? "", raw.description_preview ?? "") : null;
    const currentParsed = raw && currentSku
      ? parseListingOptions({
          title: raw.name ?? "",
          description: raw.description_preview ?? "",
          skuId: currentSku.id,
          skuName: currentSku.modelName,
          category: currentSku.category,
          bunjangConditionLabel: raw.bunjang_condition_label,
          defaultProductType: currentSku.defaultProductType ?? null,
        })
      : null;
    const decision = evaluatePoolGate(
      { sku: currentSku, category: currentSku?.category ?? pool.category as Sku["category"] | null },
      { categoryReadiness: CATEGORY_READINESS, laneReadiness: LANE_READINESS },
    );
    const extra = extraPids.includes(pid);
    const keyDrift = includeKeyDrift && Boolean(pool.comparable_key && currentParsed?.comparableKey && pool.comparable_key !== currentParsed.comparableKey);
    if (decision.canEnterPool && !extra && !keyDrift) continue;
    candidates.push({
      pid,
      status: pool.status,
      category: pool.category,
      title: raw?.name ?? null,
      rawSkuId: raw?.sku_id ?? null,
      currentSkuId: currentSku?.id ?? null,
      currentCategory: currentSku?.category ?? null,
      poolKey: pool.comparable_key,
      currentKey: currentParsed?.comparableKey ?? null,
      reason: extra ? extraReason : keyDrift ? "wave410_pool_key_drift" : `wave410_${decision.reason}`.slice(0, 120),
      profitMin: pool.expected_profit_min,
    });
  }

  if (apply && candidates.length > 0) {
    await patchInvalidated(candidates, statuses);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    categories,
    statuses,
    scannedRows: poolRows.length,
    candidateRows: candidates.length,
    applied: apply,
    byCategory: summarizeBy(candidates, (item) => item.category),
    byReason: summarizeBy(candidates, (item) => item.reason),
    samples: candidates.slice(0, 40),
  };
  const suffix = apply ? "apply" : "dry-run";
  const jsonPath = path.join(reportsDir, `fashion-pool-gate-cleanup-${suffix}-latest.json`);
  const mdPath = path.join(reportsDir, `fashion-pool-gate-cleanup-${suffix}-latest.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, [
    "# Fashion Pool Gate Cleanup",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    "",
    "## Totals",
    `- scannedRows: ${report.scannedRows}`,
    `- candidateRows: ${report.candidateRows}`,
    `- applied: ${report.applied ? "yes" : "no"}`,
    "",
    "## By Category",
    ...Object.entries(report.byCategory).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## By Reason",
    ...Object.entries(report.byReason).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Samples",
    ...report.samples.map((row) => `- pid ${row.pid}: ${row.title} / category=${row.category} / current=${row.currentSkuId ?? "null"} / reason=${row.reason}`),
    "",
  ].join("\n"));

  console.log(JSON.stringify({
    jsonPath,
    mdPath,
    totals: {
      mode: report.mode,
      scannedRows: report.scannedRows,
      candidateRows: report.candidateRows,
      applied: report.applied,
      byCategory: report.byCategory,
      byReason: report.byReason,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
