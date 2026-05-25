import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { evaluatePoolGate } from "@/lib/candidate-pool-builder";
import { ruleMatch, type Sku } from "@/lib/catalog";
import { loadCategoryReadinessMap, loadLaneReadinessMap } from "@/lib/category-readiness";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const PATCH_CHUNK_SIZE = 80;

const DEFAULT_CATEGORIES = ["clothing", "shoe", "sport_golf", "game_console"];
const TIER_CATEGORIES = new Set(["clothing", "shoe", "sport_golf", "game_console"]);

type PoolRow = {
  pid: number;
  status: string | null;
  category: string | null;
  comparable_key: string | null;
  expected_profit_min: number | null;
  invalidated_reason: string | null;
};

type RawRow = {
  pid: number;
  sku_id: string | null;
  sku_name: string | null;
  name: string | null;
  price: number | null;
  description_preview: string | null;
  bunjang_condition_label: string | null;
};

type ParsedRow = {
  pid: number;
  parser_version: string | null;
  category: string | null;
  comparable_key: string | null;
  condition_class: string | null;
  condition_tier: string | null;
  needs_review: boolean | null;
  parse_confidence: number | null;
};

type Candidate = {
  pid: number;
  status: string | null;
  title: string | null;
  category: string | null;
  oldSkuId: string | null;
  currentSkuId: string | null;
  oldKey: string | null;
  poolKey: string | null;
  currentKey: string | null;
  oldTier: string | null;
  currentTier: string | null;
  gateReason: string;
  action: "refresh" | "reclassify" | "reject_current_catalog";
  invalidatePool: boolean;
  reasons: string[];
  parsedRow: Record<string, unknown> | null;
  rawPatch: { pid: number; skuId: string | null; skuName: string | null } | null;
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

function normTier(value: string | null | undefined) {
  const raw = value?.trim().toLowerCase();
  if (!raw) return null;
  if (raw === "s" || raw === "s_grade") return "s_grade";
  if (raw === "a" || raw === "a_grade") return "a_grade";
  if (raw === "b" || raw === "b_grade") return "b_grade";
  if (raw === "c" || raw === "c_grade") return "c_grade";
  if (raw === "d" || raw === "reject") return "reject";
  if (raw === "unknown" || raw === "unknown_condition") return "unknown_condition";
  return raw;
}

function summarizeBy(items: Candidate[], selector: (item: Candidate) => string | null | undefined) {
  const out: Record<string, number> = {};
  for (const item of items) {
    const key = selector(item) ?? "(null)";
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

async function fetchRawRows(pids: number[]) {
  const rows: RawRow[] = [];
  for (const part of chunk([...new Set(pids)], 200)) {
    rows.push(...await fetchJson<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sku_name,name,price,description_preview,bunjang_condition_label&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

async function fetchParsedRows(pids: number[]) {
  const rows: ParsedRow[] = [];
  for (const part of chunk([...new Set(pids)], 200)) {
    rows.push(...await fetchJson<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=pid,parser_version,category,comparable_key,condition_class,condition_tier,needs_review,parse_confidence&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

async function fetchPoolRows(categories: string[], statuses: string[], extraPids: number[]) {
  const rows = await fetchJson<PoolRow>(
    `${tableUrl("mvp_candidate_pool")}?select=pid,status,category,comparable_key,expected_profit_min,invalidated_reason&category=in.(${categories.join(",")})&status=in.(${statuses.join(",")})&order=expected_profit_min.desc&limit=5000`,
  );
  const missingExtra = extraPids.filter((pid) => !rows.some((row) => Number(row.pid) === pid));
  for (const part of chunk(missingExtra, 200)) {
    rows.push(...await fetchJson<PoolRow>(
      `${tableUrl("mvp_candidate_pool")}?select=pid,status,category,comparable_key,expected_profit_min,invalidated_reason&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

async function patchRawRows(rows: Array<{ pid: number; skuId: string | null; skuName: string | null }>) {
  for (const row of rows) {
    await restFetch(`${tableUrl("mvp_raw_listings")}?pid=eq.${row.pid}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        sku_id: row.skuId,
        sku_name: row.skuName,
        score_dirty: true,
        ...(row.skuId ? {} : { pool_eligible: false }),
      }),
    });
  }
}

async function markRawDirty(pids: number[]) {
  for (const part of chunk([...new Set(pids)], PATCH_CHUNK_SIZE)) {
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

async function patchParsedRejected(pids: number[], reason: string) {
  for (const part of chunk(pids, PATCH_CHUNK_SIZE)) {
    await restFetch(`${tableUrl("mvp_listing_parsed")}?pid=in.${inList(part)}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        comparable_key: null,
        needs_review: true,
        parse_confidence: 0.45,
        parser_version: reason,
      }),
    });
  }
}

async function invalidatePool(candidates: Candidate[], statuses: string[]) {
  const updatedAt = new Date().toISOString();
  const byReason = new Map<string, number[]>();
  for (const candidate of candidates) {
    const reason = `wave804_${candidate.reasons[0] ?? "pool_cleanup"}`.slice(0, 120);
    const pids = byReason.get(reason) ?? [];
    pids.push(candidate.pid);
    byReason.set(reason, pids);
  }
  for (const [reason, pids] of byReason.entries()) {
    for (const part of chunk(pids, PATCH_CHUNK_SIZE)) {
      await restFetch(`${tableUrl("mvp_candidate_pool")}?pid=in.${inList(part)}&status=in.(${statuses.join(",")})`, {
        method: "PATCH",
        headers: serviceHeaders("return=minimal"),
        body: jsonBody({
          status: "invalidated",
          invalidated_reason: reason,
          reserved_until: null,
          updated_at: updatedAt,
        }),
      });
    }
  }
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const apply = hasFlag("apply");
  const categories = arg("categories", DEFAULT_CATEGORIES.join(",")).split(",").map((item) => item.trim()).filter(Boolean);
  const statuses = arg("statuses", "ready,reserved").split(",").map((item) => item.trim()).filter(Boolean);
  const extraPids = arg("pids", "").split(",").map((item) => Number(item.trim())).filter(Number.isFinite);
  const reason = arg("reason", "wave804_cross_category_current_reparse_cleanup").slice(0, 120);
  const [categoryReadiness, laneReadiness] = await Promise.all([
    loadCategoryReadinessMap(),
    loadLaneReadinessMap(),
  ]);

  const poolRows = await fetchPoolRows(categories, statuses, extraPids);
  const pids = [...new Set(poolRows.map((row) => Number(row.pid)).filter(Number.isFinite))];
  const rawRows = await fetchRawRows(pids);
  const parsedRows = await fetchParsedRows(pids);
  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));
  const candidates: Candidate[] = [];

  for (const pool of poolRows) {
    const pid = Number(pool.pid);
    const raw = rawByPid.get(pid);
    const oldParsed = parsedByPid.get(pid);
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
    const currentRow = currentParsed ? toParsedListingRow(pid, currentParsed) : null;
    const gate = evaluatePoolGate(
      { sku: currentSku, category: currentSku?.category ?? pool.category as Sku["category"] | null },
      { categoryReadiness, laneReadiness },
    );
    const currentKey = currentRow?.comparable_key as string | null | undefined;
    const currentTier = currentRow?.condition_tier as string | null | undefined;
    const reasons: string[] = [];
    if (!raw) reasons.push("missing_raw");
    if (!currentSku) reasons.push("current_catalog_rejects");
    if (currentSku && raw?.sku_id !== currentSku.id) reasons.push("sku_drift");
    if (currentRow && oldParsed?.parser_version !== currentRow.parser_version) reasons.push("parser_version_stale");
    if (currentRow && oldParsed?.comparable_key !== currentKey) reasons.push("parsed_key_drift");
    if (currentRow && pool.comparable_key !== currentKey) reasons.push("pool_key_drift");
    if (currentRow && oldParsed?.condition_class !== currentRow.condition_class) reasons.push("condition_class_drift");
    if (
      currentRow &&
      TIER_CATEGORIES.has(currentSku?.category ?? oldParsed?.category ?? pool.category ?? "") &&
      normTier(oldParsed?.condition_tier) !== normTier(currentTier)
    ) {
      reasons.push(oldParsed?.condition_tier ? "condition_tier_drift" : "condition_tier_missing");
    }
    if (!gate.canEnterPool) reasons.push(`gate_blocked_${gate.reason}`);

    const actionableReasons = reasons.filter((item) =>
      item !== "parser_version_stale" &&
      item !== "condition_class_drift"
    );
    if (actionableReasons.length === 0) continue;

    const invalidatePoolRow = reasons.some((item) =>
      item === "current_catalog_rejects" ||
      item === "parsed_key_drift" ||
      item === "pool_key_drift" ||
      item === "condition_tier_drift" ||
      item === "condition_tier_missing" ||
      item.startsWith("gate_blocked_")
    );

    candidates.push({
      pid,
      status: pool.status,
      title: raw?.name ?? null,
      category: pool.category ?? oldParsed?.category ?? currentSku?.category ?? null,
      oldSkuId: raw?.sku_id ?? null,
      currentSkuId: currentSku?.id ?? null,
      oldKey: oldParsed?.comparable_key ?? null,
      poolKey: pool.comparable_key,
      currentKey: currentKey ?? null,
      oldTier: oldParsed?.condition_tier ?? null,
      currentTier: currentTier ?? null,
      gateReason: gate.reason,
      action: !currentSku ? "reject_current_catalog" : raw?.sku_id !== currentSku.id ? "reclassify" : "refresh",
      invalidatePool: invalidatePoolRow,
      reasons,
      parsedRow: currentRow,
      rawPatch: raw && (!currentSku || raw.sku_id !== currentSku.id)
        ? { pid, skuId: currentSku?.id ?? null, skuName: currentSku?.modelName ?? null }
        : null,
    });
  }

  if (apply && candidates.length > 0) {
    await patchRawRows(candidates.map((item) => item.rawPatch).filter((item): item is NonNullable<typeof item> => Boolean(item)));
    await upsertParsed(candidates.map((item) => item.parsedRow).filter((item): item is Record<string, unknown> => Boolean(item)));
    await patchParsedRejected(candidates.filter((item) => item.action === "reject_current_catalog").map((item) => item.pid), reason);
    await markRawDirty(candidates.map((item) => item.pid));
    await invalidatePool(candidates.filter((item) => item.invalidatePool), statuses);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    categories,
    statuses,
    reason,
    totals: {
      scannedPoolRows: poolRows.length,
      rawRows: rawRows.length,
      parsedRows: parsedRows.length,
      candidateRows: candidates.length,
      invalidatePoolRows: candidates.filter((item) => item.invalidatePool).length,
      reclassifyRows: candidates.filter((item) => item.action === "reclassify").length,
      rejectRows: candidates.filter((item) => item.action === "reject_current_catalog").length,
      refreshRows: candidates.filter((item) => item.action === "refresh").length,
      applied: apply,
    },
    byCategory: summarizeBy(candidates, (item) => item.category),
    byAction: summarizeBy(candidates, (item) => item.action),
    byPrimaryReason: summarizeBy(candidates, (item) => item.reasons[0]),
    samples: candidates.slice(0, 80).map(({ parsedRow: _parsedRow, rawPatch: _rawPatch, ...item }) => item),
  };
  const suffix = apply ? "apply" : "dry-run";
  const jsonPath = path.join(reportsDir, `cross-category-current-reparse-cleanup-${suffix}-latest.json`);
  const mdPath = path.join(reportsDir, `cross-category-current-reparse-cleanup-${suffix}-latest.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, [
    "# Cross Category Current Reparse Cleanup",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    "",
    "## Totals",
    ...Object.entries(report.totals).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## By Category",
    ...Object.entries(report.byCategory).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## By Action",
    ...Object.entries(report.byAction).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## By Primary Reason",
    ...Object.entries(report.byPrimaryReason).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Samples",
    ...report.samples.map((row) => `- pid ${row.pid}: ${row.title} / ${row.oldSkuId}->${row.currentSkuId ?? "null"} / key=${row.oldKey}->${row.currentKey} / tier=${row.oldTier}->${row.currentTier} / pool=${row.status} / invalidate=${row.invalidatePool ? "yes" : "no"} / reasons=${row.reasons.join(",")}`),
    "",
  ].join("\n"));

  console.log(JSON.stringify({
    jsonPath,
    mdPath,
    totals: report.totals,
    byCategory: report.byCategory,
    byAction: report.byAction,
    byPrimaryReason: report.byPrimaryReason,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
