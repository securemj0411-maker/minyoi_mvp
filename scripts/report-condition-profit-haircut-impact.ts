import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { summarizeConditionChips } from "@/lib/condition-chip-policy";
import { mergeConditionDisplayChips } from "@/lib/condition-display";
import { normalizeMarketplaceSource } from "@/lib/marketplace-source";
import { bandFromProfit } from "@/lib/pool-policy.mjs";
import {
  conditionResaleAdjustmentKrw,
  resellShippingFeeForSource,
  safetyBufferForSource,
  sellingFeeForMarketPrice,
} from "@/lib/profit";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

type PoolRow = {
  pid: number;
  status: string | null;
  category: string | null;
  condition_class: string | null;
  expected_profit_min: number | null;
  expected_profit_max: number | null;
};

type PoolStatusRow = {
  pid: number;
  status: string | null;
  invalidated_reason: string | null;
};

type PoolProfitRow = {
  pid: number;
  expected_profit_min: number | null;
  expected_profit_max: number | null;
};

type ListingRow = {
  pid: number;
  name: string | null;
  price: number | null;
  sku_median: number | null;
  shipping_fee: number | null;
  shipping_fee_general: number | null;
  estimated_buy_cost: number | null;
};

type RawRow = {
  pid: number;
  source: string | null;
  seller_source: string | null;
};

type RawScoreDirtyRow = {
  pid: number;
  score_dirty: boolean | null;
};

type ParsedRow = {
  pid: number;
  condition_class: string | null;
  condition_tier: string | null;
  condition_notes: string[] | null;
  parsed_json: Record<string, unknown> | null;
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

function boolArg(name: string, fallback: boolean) {
  const exact = `--${name}`;
  const match = process.argv.find((item) => item === exact || item.startsWith(`${exact}=`));
  if (!match) return fallback;
  if (match === exact) return true;
  return /^(1|true|yes|y)$/i.test(match.slice(exact.length + 1));
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

async function fetchByPid<T>(table: string, select: string, pids: number[]) {
  const rows: T[] = [];
  for (const part of chunk([...new Set(pids)], 400)) {
    rows.push(...await restJson<T>(
      `${tableUrl(table)}?select=${select}&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

async function markRawScoreDirty(pids: number[]) {
  const unique = [...new Set(pids.map(Number).filter(Number.isFinite))];
  let marked = 0;
  for (const part of chunk(unique, 100)) {
    await restFetch(`${tableUrl("mvp_raw_listings")}?pid=in.${inList(part)}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({ score_dirty: true }),
    });
    marked += part.length;
  }
  return { markedRows: marked, markedPids: unique };
}

async function invalidateCandidatePoolRows(pids: number[], reason: string) {
  const unique = [...new Set(pids.map(Number).filter(Number.isFinite))];
  const updatedAt = new Date().toISOString();
  let invalidated = 0;
  for (const part of chunk(unique, 50)) {
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
    invalidated += part.length;
  }
  return { invalidatedRows: invalidated, invalidatedPids: unique, reason: reason.slice(0, 120) };
}

async function patchCandidatePoolProfits(rows: Array<{
  pid: number;
  category: string | null;
  newProfitMin: number;
  newProfitMax: number;
}>) {
  const uniqueByPid = new Map<number, {
    pid: number;
    category: string | null;
    newProfitMin: number;
    newProfitMax: number;
  }>();
  for (const row of rows) {
    const pid = Number(row.pid);
    if (!Number.isFinite(pid)) continue;
    uniqueByPid.set(pid, { ...row, pid });
  }
  const updatedAt = new Date().toISOString();
  for (const row of uniqueByPid.values()) {
    const band = bandFromProfit(row.newProfitMin, row.newProfitMax, row.category);
    await restFetch(`${tableUrl("mvp_candidate_pool")}?pid=eq.${row.pid}&status=in.(ready,reserved)`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        expected_profit_min: row.newProfitMin,
        expected_profit_max: row.newProfitMax,
        ...(band == null ? {} : { profit_band: band }),
        updated_at: updatedAt,
      }),
    });
  }
  return { patchedRows: uniqueByPid.size, patchedPids: [...uniqueByPid.keys()] };
}

function positiveNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function countBy<T>(rows: T[], fn: (row: T) => string | null | undefined) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const key = fn(row) ?? "unknown";
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function pct(part: number, total: number) {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10;
}

function mdTable(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((cell) => String(cell ?? "")).join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const limit = Number(arg("limit", "10000"));
  const statuses = arg("statuses", "ready,reserved")
    .split(",")
    .map((status) => status.trim())
    .filter(Boolean);
  const poolRows = await fetchAll<PoolRow>(
    `${tableUrl("mvp_candidate_pool")}?select=pid,status,category,condition_class,expected_profit_min,expected_profit_max&status=in.(${statuses.join(",")})`,
    limit,
    "updated_at.desc",
  );
  const pids = poolRows.map((row) => Number(row.pid)).filter(Number.isFinite);
  const [listingRows, rawRows, parsedRows] = await Promise.all([
    fetchByPid<ListingRow>("mvp_listings", "pid,name,price,sku_median,shipping_fee,shipping_fee_general,estimated_buy_cost", pids),
    fetchByPid<RawRow>("mvp_raw_listings", "pid,source,seller_source", pids),
    fetchByPid<ParsedRow>("mvp_listing_parsed", "pid,condition_class,condition_tier,condition_notes,parsed_json", pids),
  ]);

  const listingByPid = new Map(listingRows.map((row) => [Number(row.pid), row]));
  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));

  const auditedRows = poolRows.flatMap((pool) => {
    const pid = Number(pool.pid);
    const listing = listingByPid.get(pid);
    const raw = rawByPid.get(pid);
    const parsed = parsedByPid.get(pid);
    const marketPrice = positiveNumber(listing?.sku_median);
    const buyPrice = positiveNumber(listing?.price);
    if (marketPrice == null || buyPrice == null) return [];
    const grade = (parsed?.parsed_json?.condition_grade as { chips?: string[]; tier?: string } | null) ?? null;
    const parsedJsonNotes = parsed?.parsed_json?.condition_notes as string[] | undefined;
    const chips = mergeConditionDisplayChips(grade?.chips ?? null, parsed?.condition_notes ?? parsedJsonNotes ?? null) ?? [];
    const summary = summarizeConditionChips(chips);
    const source = normalizeMarketplaceSource(raw?.source ?? raw?.seller_source ?? null);
    const shippingFee = Number(listing?.shipping_fee ?? 0);
    const generalShipping = listing?.shipping_fee_general == null ? shippingFee : Number(listing.shipping_fee_general ?? 0);
    const buyMin = positiveNumber(listing?.estimated_buy_cost) ?? buyPrice + shippingFee;
    const buyMax = buyPrice + Math.max(0, generalShipping);
    const oldSellFee = sellingFeeForMarketPrice(marketPrice, source);
    const resellShipping = resellShippingFeeForSource(source);
    const safetyBuffer = safetyBufferForSource(source);
    const oldProfitMin = Math.max(0, Math.round(marketPrice - buyMax - oldSellFee - resellShipping - safetyBuffer));
    const oldProfitMax = Math.max(0, Math.round(marketPrice - buyMin - oldSellFee - resellShipping - safetyBuffer));
    const conditionAdjustment = conditionResaleAdjustmentKrw({
      marketPrice,
      conditionChips: chips,
      conditionClass: pool.condition_class ?? parsed?.condition_class ?? null,
      conditionTier: parsed?.condition_tier ?? grade?.tier ?? null,
    });
    const adjustedMarketPrice = Math.max(0, marketPrice - conditionAdjustment);
    const newSellFee = sellingFeeForMarketPrice(adjustedMarketPrice, source);
    const newProfitMin = Math.max(0, Math.round(adjustedMarketPrice - buyMax - newSellFee - resellShipping - safetyBuffer));
    const newProfitMax = Math.max(0, Math.round(adjustedMarketPrice - buyMin - newSellFee - resellShipping - safetyBuffer));
    return [{
      pid,
      title: listing?.name ?? "",
      status: pool.status,
      source,
      category: pool.category,
      marketPrice,
      price: buyPrice,
      conditionClass: pool.condition_class ?? parsed?.condition_class ?? null,
      conditionTier: parsed?.condition_tier ?? grade?.tier ?? null,
      chips,
      softAdjustment: summary.softAdjustment,
      conditionAdjustment,
      oldProfitMin,
      oldProfitMax,
      newProfitMin,
      newProfitMax,
      profitMaxDrop: oldProfitMax - newProfitMax,
      poolExpectedProfitMax: Number(pool.expected_profit_max ?? 0),
      wouldLosePositiveProfit: oldProfitMax > 0 && newProfitMax <= 0,
    }];
  });

  const affectedRows = auditedRows.filter((row) => row.conditionAdjustment > 0);
  const wouldLosePositiveRows = affectedRows.filter((row) => row.wouldLosePositiveProfit);
  const stalePoolProfitRows = affectedRows.filter((row) => row.newProfitMax > 0 && row.poolExpectedProfitMax > row.newProfitMax);
  const applyRequested = boolArg("apply", false);
  const applyScopeRaw = arg("apply-scope", "drop_to_zero");
  if (!["drop_to_zero", "affected", "stale_profit"].includes(applyScopeRaw)) {
    throw new Error(`Invalid --apply-scope=${applyScopeRaw}; expected drop_to_zero, affected, or stale_profit`);
  }
  const applyScope = applyScopeRaw as "drop_to_zero" | "affected" | "stale_profit";
  const applyActionRaw = arg("apply-action", "score_dirty");
  if (!["score_dirty", "invalidate_pool", "patch_profit"].includes(applyActionRaw)) {
    throw new Error(`Invalid --apply-action=${applyActionRaw}; expected score_dirty, invalidate_pool, or patch_profit`);
  }
  const applyAction = applyActionRaw as "score_dirty" | "invalidate_pool" | "patch_profit";
  if (applyAction === "invalidate_pool" && applyScope !== "drop_to_zero") {
    throw new Error("--apply-action=invalidate_pool is only allowed with --apply-scope=drop_to_zero");
  }
  if (applyAction === "patch_profit" && applyScope !== "stale_profit") {
    throw new Error("--apply-action=patch_profit is only allowed with --apply-scope=stale_profit");
  }
  const applyLimit = Math.max(0, Math.floor(Number(arg("apply-limit", "50")) || 0));
  const applyCandidates = (
    applyScope === "affected"
      ? affectedRows
      : applyScope === "stale_profit"
        ? stalePoolProfitRows
        : wouldLosePositiveRows
  )
    .slice()
    .sort((a, b) => (
      applyScope === "stale_profit"
        ? (b.poolExpectedProfitMax - b.newProfitMax) - (a.poolExpectedProfitMax - a.newProfitMax)
        : b.profitMaxDrop - a.profitMaxDrop
    ));
  const applyRows = applyCandidates.slice(0, applyLimit);
  const applyResult = {
    requested: applyRequested,
    action: applyAction,
    scope: applyScope,
    limit: applyLimit,
    candidateRows: applyCandidates.length,
    plannedRows: applyRows.length,
    markedRows: 0,
    verifiedScoreDirtyRows: 0,
    invalidatedRows: 0,
    verifiedInvalidatedRows: 0,
    invalidatedReason: null as string | null,
    patchedRows: 0,
    verifiedPatchedRows: 0,
    markedPids: [] as number[],
  };
  if (applyRequested && applyRows.length > 0) {
    const targetPids = applyRows.map((row) => row.pid);
    if (applyAction === "score_dirty") {
      const result = await markRawScoreDirty(targetPids);
      applyResult.markedRows = result.markedRows;
      applyResult.markedPids = result.markedPids;
      const verified = await fetchByPid<RawScoreDirtyRow>("mvp_raw_listings", "pid,score_dirty", result.markedPids);
      applyResult.verifiedScoreDirtyRows = verified.filter((row) => row.score_dirty === true).length;
    } else if (applyAction === "invalidate_pool") {
      const reason = "condition_haircut_profit_not_positive";
      const result = await invalidateCandidatePoolRows(targetPids, reason);
      applyResult.invalidatedRows = result.invalidatedRows;
      applyResult.markedPids = result.invalidatedPids;
      applyResult.invalidatedReason = result.reason;
      const verified = await fetchByPid<PoolStatusRow>("mvp_candidate_pool", "pid,status,invalidated_reason", result.invalidatedPids);
      applyResult.verifiedInvalidatedRows = verified.filter((row) => (
        row.status === "invalidated" && row.invalidated_reason === result.reason
      )).length;
    } else {
      const result = await patchCandidatePoolProfits(applyRows);
      applyResult.patchedRows = result.patchedRows;
      applyResult.markedPids = result.patchedPids;
      const expectedByPid = new Map(applyRows.map((row) => [row.pid, row]));
      const verified = await fetchByPid<PoolProfitRow>(
        "mvp_candidate_pool",
        "pid,expected_profit_min,expected_profit_max",
        result.patchedPids,
      );
      applyResult.verifiedPatchedRows = verified.filter((row) => {
        const expected = expectedByPid.get(Number(row.pid));
        return expected
          && Number(row.expected_profit_min ?? NaN) === expected.newProfitMin
          && Number(row.expected_profit_max ?? NaN) === expected.newProfitMax;
      }).length;
    }
  }
  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: !applyRequested,
    mutation: applyRequested,
    apply: applyResult,
    scope: {
      statuses,
      limit,
      poolRows: poolRows.length,
      auditedRows: auditedRows.length,
    },
    metrics: {
      affectedRows: affectedRows.length,
      affectedRate: pct(affectedRows.length, auditedRows.length),
      wouldLosePositiveProfitRows: wouldLosePositiveRows.length,
      wouldLosePositiveProfitRate: pct(wouldLosePositiveRows.length, auditedRows.length),
      stalePoolProfitRows: stalePoolProfitRows.length,
      stalePoolProfitRate: pct(stalePoolProfitRows.length, auditedRows.length),
      totalPoolProfitOverstatement: stalePoolProfitRows.reduce(
        (sum, row) => sum + Math.max(0, row.poolExpectedProfitMax - row.newProfitMax),
        0,
      ),
      avgPoolProfitOverstatement: stalePoolProfitRows.length === 0
        ? 0
        : Math.round(stalePoolProfitRows.reduce(
          (sum, row) => sum + Math.max(0, row.poolExpectedProfitMax - row.newProfitMax),
          0,
        ) / stalePoolProfitRows.length),
      totalProfitMaxDrop: affectedRows.reduce((sum, row) => sum + row.profitMaxDrop, 0),
      avgProfitMaxDropAffected: affectedRows.length === 0
        ? 0
        : Math.round(affectedRows.reduce((sum, row) => sum + row.profitMaxDrop, 0) / affectedRows.length),
    },
    affectedBySource: countBy(affectedRows, (row) => row.source),
    affectedByCategory: countBy(affectedRows, (row) => row.category),
    affectedSoftChipCounts: countBy(
      affectedRows.flatMap((row) => row.softAdjustment.map((chip) => ({ chip }))),
      (row) => row.chip,
    ),
    topDrops: affectedRows
      .sort((a, b) => b.profitMaxDrop - a.profitMaxDrop)
      .slice(0, 50),
    wouldLosePositiveProfitSamples: wouldLosePositiveRows
      .sort((a, b) => b.profitMaxDrop - a.profitMaxDrop)
      .slice(0, 50),
    stalePoolProfitSamples: stalePoolProfitRows
      .sort((a, b) => (b.poolExpectedProfitMax - b.newProfitMax) - (a.poolExpectedProfitMax - a.newProfitMax))
      .slice(0, 50),
  };

  await writeFile(path.join(reportsDir, "condition-profit-haircut-impact-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    "# Condition Profit Haircut Impact",
    "",
    `Generated: ${report.generatedAt}`,
    `Mutation: ${report.mutation ? report.apply.action : "none (dry-run)"}`,
    `Apply scope: ${report.apply.scope} · candidates ${report.apply.candidateRows} · planned ${report.apply.plannedRows} · limit ${report.apply.limit}`,
    `Apply result: score_dirty ${report.apply.markedRows}/${report.apply.verifiedScoreDirtyRows} · invalidated ${report.apply.invalidatedRows}/${report.apply.verifiedInvalidatedRows} · patched ${report.apply.patchedRows}/${report.apply.verifiedPatchedRows}`,
    "",
    "## Metrics",
    "",
    mdTable(["metric", "value"], Object.entries(report.metrics)),
    "",
    "## Affected By Source",
    "",
    mdTable(["source", "count"], Object.entries(report.affectedBySource)),
    "",
    "## Affected Soft Chips",
    "",
    mdTable(["chip", "count"], Object.entries(report.affectedSoftChipCounts)),
    "",
    "## Top Drops",
    "",
    mdTable(
      ["pid", "source", "category", "adjustment", "oldMax", "newMax", "chips", "title"],
      report.topDrops.slice(0, 20).map((row) => [
        row.pid,
        row.source,
        row.category,
        row.conditionAdjustment,
        row.oldProfitMax,
        row.newProfitMax,
        row.softAdjustment.join(", "),
        row.title.slice(0, 70),
      ]),
    ),
    "",
    "## Stale Pool Profit Samples",
    "",
    mdTable(
      ["pid", "source", "category", "poolMax", "newMax", "over", "chips", "title"],
      report.stalePoolProfitSamples.slice(0, 20).map((row) => [
        row.pid,
        row.source,
        row.category,
        row.poolExpectedProfitMax,
        row.newProfitMax,
        Math.max(0, row.poolExpectedProfitMax - row.newProfitMax),
        row.softAdjustment.join(", "),
        row.title.slice(0, 70),
      ]),
    ),
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "condition-profit-haircut-impact-latest.md"), `${md}\n`);
  console.log(JSON.stringify({
    reportJson: "reports/condition-profit-haircut-impact-latest.json",
    reportMd: "reports/condition-profit-haircut-impact-latest.md",
    apply: report.apply,
    metrics: report.metrics,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
