import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { evaluatePoolGate } from "@/lib/candidate-pool-builder";
import { ruleMatch, type Sku } from "@/lib/catalog";
import { CATEGORY_READINESS, LANE_READINESS } from "@/lib/category-readiness";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const REASON = "wave811_shoe_exact_axis_cleanup";
const PATCH_CHUNK_SIZE = 80;

const TARGET_SKU_IDS = [
  "shoe-asics-gel-kayano",
  "shoe-adidas-football",
  "shoe-bape-sta",
  "shoe-gucci-rhyton",
  "shoe-puma-football",
  "shoe-vans-style-36",
  "shoe-nike-dunk-low-black-white",
  "shoe-nike-blazer-broad",
  "shoe-offwhite-nike-blazer-mid",
  "shoe-offwhite-nike-blazer-low",
  "shoe-readymade-nike-blazer-mid",
  "shoe-supreme-nike-sb-blazer",
  "shoe-stranger-things-nike-blazer",
  "shoe-travis-nike-airmax-1",
];

type RawRow = {
  pid: number;
  sku_id: string | null;
  sku_name: string | null;
  name: string | null;
  description_preview: string | null;
  bunjang_condition_label: string | null;
  pool_eligible: boolean | null;
};

type ParsedRow = {
  pid: number;
  comparable_key: string | null;
  needs_review: boolean | null;
  parse_confidence: number | null;
  parser_version: string | null;
};

type PoolRow = {
  pid: number;
  status: string | null;
  comparable_key: string | null;
  category: string | null;
};

type PlanRow = {
  pid: number;
  title: string | null;
  oldSkuId: string | null;
  currentSkuId: string | null;
  oldKey: string | null;
  currentKey: string | null;
  poolStatus: string | null;
  poolKey: string | null;
  gateReason: string | null;
  action: "reject_no_current_match" | "internal_only_gate_blocked" | "reclassify_to_current" | "reparse_key_drift" | "unchanged";
  invalidatePool: boolean;
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

async function fetchRows<T>(table: string, select: string, pids: number[]) {
  const out: T[] = [];
  for (const part of chunk([...new Set(pids)].filter(Number.isFinite), 200)) {
    if (part.length === 0) continue;
    out.push(...await fetchJson<T>(
      `${tableUrl(table)}?select=${select}&pid=in.${inList(part)}&order=pid.asc&limit=${part.length}`,
    ));
  }
  return out;
}

async function fetchRawBySkuIds(skuIds: string[]) {
  const rows: RawRow[] = [];
  for (const skuId of skuIds) {
    rows.push(...await fetchJson<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sku_name,name,description_preview,bunjang_condition_label,pool_eligible&sku_id=eq.${encodeURIComponent(skuId)}&order=pid.asc&limit=2000`,
    ));
  }
  const byPid = new Map<number, RawRow>();
  for (const row of rows) byPid.set(Number(row.pid), row);
  return [...byPid.values()].sort((a, b) => Number(a.pid) - Number(b.pid));
}

function parsedForRaw(pid: number, raw: RawRow, sku: Sku) {
  const parsed = parseListingOptions({
    title: raw.name ?? "",
    description: raw.description_preview ?? "",
    skuId: sku.id,
    skuName: sku.modelName,
    category: sku.category,
    bunjangConditionLabel: raw.bunjang_condition_label,
    defaultProductType: sku.defaultProductType ?? null,
  });
  return toParsedListingRow(pid, parsed);
}

async function patchRawRejected(pids: number[]) {
  for (const part of chunk(pids, PATCH_CHUNK_SIZE)) {
    await restFetch(`${tableUrl("mvp_raw_listings")}?pid=in.${inList(part)}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        sku_id: null,
        sku_name: null,
        pool_eligible: false,
        score_dirty: true,
      }),
    });
  }
}

async function patchParsedRejected(pids: number[]) {
  for (const part of chunk(pids, PATCH_CHUNK_SIZE)) {
    await restFetch(`${tableUrl("mvp_listing_parsed")}?pid=in.${inList(part)}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        comparable_key: null,
        needs_review: true,
        parse_confidence: 0.45,
        parser_version: REASON,
      }),
    });
  }
}

async function patchRawInternalOnly(pids: number[]) {
  for (const part of chunk(pids, PATCH_CHUNK_SIZE)) {
    await restFetch(`${tableUrl("mvp_raw_listings")}?pid=in.${inList(part)}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        pool_eligible: false,
        score_dirty: true,
      }),
    });
  }
}

async function patchRawReclassified(row: PlanRow, sku: Sku, canEnterPool: boolean) {
  await restFetch(`${tableUrl("mvp_raw_listings")}?pid=eq.${row.pid}`, {
    method: "PATCH",
    headers: serviceHeaders("return=minimal"),
    body: jsonBody({
      sku_id: sku.id,
      sku_name: sku.modelName,
      pool_eligible: canEnterPool,
      score_dirty: true,
    }),
  });
}

async function patchRawScoreDirty(pids: number[]) {
  for (const part of chunk(pids, PATCH_CHUNK_SIZE)) {
    await restFetch(`${tableUrl("mvp_raw_listings")}?pid=in.${inList(part)}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({ score_dirty: true }),
    });
  }
}

async function upsertParsed(rows: Record<string, unknown>[]) {
  for (const part of chunk(rows, PATCH_CHUNK_SIZE)) {
    await restFetch(`${tableUrl("mvp_listing_parsed")}?on_conflict=pid`, {
      method: "POST",
      headers: serviceHeaders("resolution=merge-duplicates,return=minimal"),
      body: jsonBody(part),
    });
  }
}

async function invalidatePool(pids: number[], reason: string) {
  const updatedAt = new Date().toISOString();
  for (const part of chunk(pids, PATCH_CHUNK_SIZE)) {
    await restFetch(`${tableUrl("mvp_candidate_pool")}?pid=in.${inList(part)}&status=in.(ready,reserved)`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        status: "invalidated",
        invalidated_reason: reason.slice(0, 120),
        reserved_until: null,
        updated_at: updatedAt,
      }),
    });
  }
}

function groupCounts(rows: PlanRow[]) {
  const out: Record<string, number> = {};
  for (const row of rows) out[row.action] = (out[row.action] ?? 0) + 1;
  return out;
}

function keyDriftCounts(rows: PlanRow[]) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    if (row.oldKey === row.currentKey) continue;
    const key = `${row.oldKey ?? "null"} -> ${row.currentKey ?? "null"}`;
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 30));
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const apply = hasFlag("apply");
  const rawRows = await fetchRawBySkuIds(TARGET_SKU_IDS);
  const pids = rawRows.map((row) => Number(row.pid));
  const [parsedRows, poolRows] = await Promise.all([
    fetchRows<ParsedRow>("mvp_listing_parsed", "pid,comparable_key,needs_review,parse_confidence,parser_version", pids),
    fetchRows<PoolRow>("mvp_candidate_pool", "pid,status,comparable_key,category", pids),
  ]);

  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));
  const poolByPid = new Map(poolRows.map((row) => [Number(row.pid), row]));
  const parsedUpserts: Record<string, unknown>[] = [];
  const currentSkuByPid = new Map<number, Sku>();
  const currentGateByPid = new Map<number, { canEnterPool: boolean; reason: string | null }>();

  const plan: PlanRow[] = rawRows.map((raw) => {
    const pid = Number(raw.pid);
    const currentSku = ruleMatch(raw.name ?? "", raw.description_preview ?? "");
    const oldParsed = parsedByPid.get(pid);
    const pool = poolByPid.get(pid);
    const gate = evaluatePoolGate(
      { sku: currentSku, category: currentSku?.category ?? null },
      { categoryReadiness: CATEGORY_READINESS, laneReadiness: LANE_READINESS },
    );
    let currentKey: string | null = null;
    if (currentSku) {
      const parsedRow = parsedForRaw(pid, raw, currentSku);
      currentKey = (parsedRow.comparable_key as string | null | undefined) ?? null;
      parsedUpserts.push(parsedRow);
      currentSkuByPid.set(pid, currentSku);
    }
    currentGateByPid.set(pid, { canEnterPool: gate.canEnterPool, reason: gate.reason });

    let action: PlanRow["action"] = "unchanged";
    if (!currentSku) action = "reject_no_current_match";
    else if (currentSku.id !== raw.sku_id) action = "reclassify_to_current";
    else if (!gate.canEnterPool) action = "internal_only_gate_blocked";
    else if ((oldParsed?.comparable_key ?? null) !== currentKey) action = "reparse_key_drift";

    const invalidatePoolRow = Boolean(
      pool &&
      (pool.status === "ready" || pool.status === "reserved") &&
      action !== "unchanged" &&
      (!currentSku || !gate.canEnterPool || pool.comparable_key !== currentKey),
    );

    return {
      pid,
      title: raw.name,
      oldSkuId: raw.sku_id,
      currentSkuId: currentSku?.id ?? null,
      oldKey: oldParsed?.comparable_key ?? null,
      currentKey,
      poolStatus: pool?.status ?? null,
      poolKey: pool?.comparable_key ?? null,
      gateReason: gate.reason,
      action,
      invalidatePool: invalidatePoolRow,
    };
  });

  const changed = plan.filter((row) => row.action !== "unchanged");
  const rejectPids = changed.filter((row) => row.action === "reject_no_current_match").map((row) => row.pid);
  const internalOnlyPids = changed.filter((row) => row.action === "internal_only_gate_blocked").map((row) => row.pid);
  const reparsePids = changed.filter((row) => row.action === "reparse_key_drift").map((row) => row.pid);
  const poolInvalidatePids = changed.filter((row) => row.invalidatePool).map((row) => row.pid);

  if (apply) {
    await patchRawRejected(rejectPids);
    await patchParsedRejected(rejectPids);

    await patchRawInternalOnly(internalOnlyPids);

    for (const row of changed.filter((item) => item.action === "reclassify_to_current")) {
      const sku = currentSkuByPid.get(row.pid);
      const gate = currentGateByPid.get(row.pid);
      if (!sku || !gate) continue;
      await patchRawReclassified(row, sku, gate.canEnterPool);
    }

    const upsertsByPid = new Map(parsedUpserts.map((row) => [Number(row.pid), row]));
    const upsertsToApply = changed
      .filter((row) => row.action !== "reject_no_current_match")
      .map((row) => upsertsByPid.get(row.pid))
      .filter((row): row is Record<string, unknown> => Boolean(row));
    await upsertParsed(upsertsToApply);
    await patchRawScoreDirty(reparsePids);
    await invalidatePool(poolInvalidatePids, `${REASON}_key_or_gate_drift`);
  }

  const byOldSku: Record<string, number> = {};
  for (const row of changed) byOldSku[row.oldSkuId ?? "null"] = (byOldSku[row.oldSkuId ?? "null"] ?? 0) + 1;
  const summary = {
    apply,
    scanned: rawRows.length,
    changed: changed.length,
    actionCounts: groupCounts(plan),
    byOldSku: Object.fromEntries(Object.entries(byOldSku).sort((a, b) => b[1] - a[1])),
    keyDriftCounts: keyDriftCounts(changed),
    invalidatedReadyOrReserved: poolInvalidatePids.length,
    targetSkuIds: TARGET_SKU_IDS,
  };

  const out = { summary, changed };
  const reportPath = path.join(reportsDir, "wave811-shoe-exact-axis-cleanup.json");
  await writeFile(reportPath, `${JSON.stringify(out, null, 2)}\n`);

  const md = [
    `# Wave 811 Shoe Exact-Axis Cleanup ${apply ? "APPLY" : "DRY RUN"}`,
    "",
    `- scanned: ${summary.scanned}`,
    `- changed: ${summary.changed}`,
    `- invalidated ready/reserved pool rows: ${summary.invalidatedReadyOrReserved}`,
    `- actionCounts: ${JSON.stringify(summary.actionCounts)}`,
    "",
    "## Changed By Old SKU",
    ...Object.entries(summary.byOldSku).map(([sku, count]) => `- ${sku}: ${count}`),
    "",
    "## Top Key Drift",
    ...Object.entries(summary.keyDriftCounts).map(([key, count]) => `- ${key}: ${count}`),
    "",
    "## Examples",
    ...changed.slice(0, 80).map((row) => `- ${row.pid} ${row.action} ${row.oldSkuId ?? "null"} -> ${row.currentSkuId ?? "null"} | ${row.oldKey ?? "null"} -> ${row.currentKey ?? "null"} | ${row.title ?? ""}`),
    "",
  ].join("\n");
  const mdPath = path.join(reportsDir, "wave811-shoe-exact-axis-cleanup.md");
  await writeFile(mdPath, md);

  console.log(JSON.stringify(summary, null, 2));
  console.log(reportPath);
  console.log(mdPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
