import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { evaluatePoolGate } from "@/lib/candidate-pool-builder";
import { ruleMatch, skuById, type Sku } from "@/lib/catalog";
import { CATEGORY_READINESS, LANE_READINESS } from "@/lib/category-readiness";
import { parseListingOptions } from "@/lib/option-parser";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const FASHION_PREFIXES = ["shoe-", "clothing-", "bag-"];
const PAGE_SIZE = 1000;

type RawRow = {
  pid: number;
  name: string | null;
  description_preview: string | null;
  sku_id: string | null;
  sku_name: string | null;
  detail_status: string | null;
  listing_type: string | null;
  listing_type_override: string | null;
  listing_state: string | null;
  sale_status: string | null;
  score_dirty: boolean | null;
  last_seen_at: string | null;
  bunjang_condition_label: string | null;
};

type ParsedRow = {
  pid: number;
  comparable_key: string | null;
  needs_review: boolean | null;
  parser_version: string | null;
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

function inc(map: Record<string, number>, key: string | null | undefined) {
  const k = key || "(null)";
  map[k] = (map[k] ?? 0) + 1;
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

function skuPrefixFilter() {
  return FASHION_PREFIXES.map((prefix) => `sku_id.like.${encodeURIComponent(`${prefix}*`)}`).join(",");
}

function rawSkuCategory(skuId: string | null) {
  if (!skuId) return null;
  if (skuId.startsWith("shoe-")) return "shoe";
  if (skuId.startsWith("clothing-")) return "clothing";
  if (skuId.startsWith("bag-")) return "bag";
  return null;
}

function isScorable(row: RawRow) {
  return (
    row.detail_status === "done" &&
    (row.listing_type === "normal" || row.listing_type_override === "normal") &&
    row.sku_id != null &&
    row.listing_state === "active"
  );
}

function notScorableReasons(row: RawRow) {
  const reasons: string[] = [];
  if (row.detail_status !== "done") reasons.push(`detail_status:${row.detail_status ?? "null"}`);
  if (!(row.listing_type === "normal" || row.listing_type_override === "normal")) reasons.push(`listing_type:${row.listing_type ?? "null"}`);
  if (!row.sku_id) reasons.push("sku_id:null");
  if (row.listing_state !== "active") reasons.push(`listing_state:${row.listing_state ?? "null"}`);
  return reasons;
}

async function loadDirtyRows(limit: number, scorableOnly: boolean) {
  const rows: RawRow[] = [];
  const columns = [
    "pid",
    "name",
    "description_preview",
    "sku_id",
    "sku_name",
    "detail_status",
    "listing_type",
    "listing_type_override",
    "listing_state",
    "sale_status",
    "score_dirty",
    "last_seen_at",
    "bunjang_condition_label",
  ].join(",");
  for (let offset = 0; rows.length < limit; offset += PAGE_SIZE) {
    const pageLimit = Math.min(PAGE_SIZE, limit - rows.length);
    const scorableFilter = scorableOnly
      ? "&detail_status=eq.done&listing_state=eq.active&sku_id=not.is.null&or=(listing_type.eq.normal,listing_type_override.eq.normal)"
      : "";
    const page = await fetchJson<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=${columns}&score_dirty=eq.true${scorableFilter}&or=(${skuPrefixFilter()})&order=last_seen_at.desc&limit=${pageLimit}&offset=${offset}`,
    );
    rows.push(...page);
    if (page.length < pageLimit) break;
  }
  return rows;
}

async function loadParsedRows(pids: number[]) {
  const rows: ParsedRow[] = [];
  for (const part of chunk(pids, 200)) {
    rows.push(...await fetchJson<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,needs_review,parser_version&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const limit = Number(arg("limit", "12000"));
  const scorableOnly = hasFlag("scorable-only");
  const rows = await loadDirtyRows(limit, scorableOnly);
  const parsedRows = await loadParsedRows(rows.map((row) => Number(row.pid)).filter(Number.isFinite));
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));

  const byRawCategory: Record<string, number> = {};
  const byCurrentCategory: Record<string, number> = {};
  const byNotScorableReason: Record<string, number> = {};
  const byGateReason: Record<string, number> = {};
  const byLane: Record<string, number> = {};
  const byBlockedLane: Record<string, number> = {};
  const byParserIssue: Record<string, number> = {};
  const samples: Record<string, unknown[]> = {
    scorableReady: [],
    scorableBlocked: [],
    currentSkuNull: [],
    rawCurrentMismatch: [],
    parsedKeyDrift: [],
  };

  let scorableRows = 0;
  let scorableReadyRows = 0;
  let scorableBlockedRows = 0;
  let currentSkuNullRows = 0;
  let rawCurrentMismatchRows = 0;
  let parsedKeyDriftRows = 0;
  let parserNeedsReviewRows = 0;

  for (const row of rows) {
    const rawCategory = rawSkuCategory(row.sku_id);
    inc(byRawCategory, rawCategory);
    const currentSku = ruleMatch(row.name ?? "", row.description_preview ?? "");
    inc(byCurrentCategory, currentSku?.category ?? null);
    const parsed = parsedByPid.get(Number(row.pid));
    const currentParsed = currentSku
      ? parseListingOptions({
          title: row.name ?? "",
          description: row.description_preview ?? "",
          skuId: currentSku.id,
          skuName: currentSku.modelName,
          category: currentSku.category,
          bunjangConditionLabel: row.bunjang_condition_label,
          defaultProductType: currentSku.defaultProductType ?? null,
        })
      : null;

    if (!currentSku) {
      currentSkuNullRows += 1;
      if (samples.currentSkuNull.length < 30) {
        samples.currentSkuNull.push({ pid: row.pid, title: row.name, rawSkuId: row.sku_id });
      }
    }
    if (currentSku && row.sku_id && currentSku.id !== row.sku_id) {
      rawCurrentMismatchRows += 1;
      if (samples.rawCurrentMismatch.length < 30) {
        samples.rawCurrentMismatch.push({ pid: row.pid, title: row.name, rawSkuId: row.sku_id, currentSkuId: currentSku.id });
      }
    }
    if (parsed?.comparable_key && currentParsed?.comparableKey && parsed.comparable_key !== currentParsed.comparableKey) {
      parsedKeyDriftRows += 1;
      if (samples.parsedKeyDrift.length < 30) {
        samples.parsedKeyDrift.push({ pid: row.pid, title: row.name, rawSkuId: row.sku_id, currentSkuId: currentSku?.id, parsedKey: parsed.comparable_key, currentKey: currentParsed.comparableKey });
      }
    }
    if (currentParsed?.needsReview || parsed?.needs_review) {
      parserNeedsReviewRows += 1;
      inc(byParserIssue, "needs_review");
    }

    for (const reason of notScorableReasons(row)) inc(byNotScorableReason, reason);
    if (!isScorable(row)) continue;

    scorableRows += 1;
    const gate = evaluatePoolGate(
      { sku: currentSku, category: currentSku?.category ?? rawCategory as Sku["category"] | null },
      { categoryReadiness: CATEGORY_READINESS, laneReadiness: LANE_READINESS },
    );
    inc(byGateReason, gate.reason);
    inc(byLane, currentSku?.laneKey ?? currentSku?.id ?? row.sku_id);
    const sample = {
      pid: row.pid,
      title: row.name,
      rawSkuId: row.sku_id,
      currentSkuId: currentSku?.id ?? null,
      laneKey: currentSku?.laneKey ?? null,
      currentKey: currentParsed?.comparableKey ?? null,
      gateReason: gate.reason,
      needsReview: currentParsed?.needsReview ?? parsed?.needs_review ?? null,
    };
    if (gate.canEnterPool && currentSku && currentParsed && !currentParsed.needsReview) {
      scorableReadyRows += 1;
      if (samples.scorableReady.length < 40) samples.scorableReady.push(sample);
    } else {
      scorableBlockedRows += 1;
      inc(byBlockedLane, currentSku?.laneKey ?? currentSku?.id ?? row.sku_id);
      if (samples.scorableBlocked.length < 40) samples.scorableBlocked.push(sample);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    limit,
    scorableOnly,
    totals: {
      loadedDirtyFashionRows: rows.length,
      scorableRows,
      scorableReadyRows,
      scorableBlockedRows,
      nonScorableRows: rows.length - scorableRows,
      currentSkuNullRows,
      rawCurrentMismatchRows,
      parsedKeyDriftRows,
      parserNeedsReviewRows,
    },
    byRawCategory,
    byCurrentCategory,
    byNotScorableReason: Object.fromEntries(Object.entries(byNotScorableReason).sort((a, b) => b[1] - a[1])),
    byGateReason: Object.fromEntries(Object.entries(byGateReason).sort((a, b) => b[1] - a[1])),
    topScorableLanes: Object.fromEntries(Object.entries(byLane).sort((a, b) => b[1] - a[1]).slice(0, 40)),
    topBlockedLanes: Object.fromEntries(Object.entries(byBlockedLane).sort((a, b) => b[1] - a[1]).slice(0, 40)),
    byParserIssue,
    samples,
  };

  const jsonPath = path.join(reportsDir, "fashion-dirty-queue-latest.json");
  const mdPath = path.join(reportsDir, "fashion-dirty-queue-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, [
    "# Fashion Dirty Queue",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Totals",
    ...Object.entries(report.totals).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Not Scorable Reasons",
    ...Object.entries(report.byNotScorableReason).slice(0, 30).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Gate Reasons",
    ...Object.entries(report.byGateReason).slice(0, 30).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Top Scorable Lanes",
    ...Object.entries(report.topScorableLanes).slice(0, 30).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Scorable Ready Samples",
    ...report.samples.scorableReady.slice(0, 25).map((row) => `- ${JSON.stringify(row)}`),
    "",
    "## Scorable Blocked Samples",
    ...report.samples.scorableBlocked.slice(0, 25).map((row) => `- ${JSON.stringify(row)}`),
    "",
  ].join("\n"));

  console.log(JSON.stringify({
    jsonPath,
    mdPath,
    totals: report.totals,
    byRawCategory: report.byRawCategory,
    byCurrentCategory: report.byCurrentCategory,
    topNotScorable: Object.entries(report.byNotScorableReason).slice(0, 10),
    topGateReasons: Object.entries(report.byGateReason).slice(0, 10),
    topScorableLanes: Object.entries(report.topScorableLanes).slice(0, 12),
    topBlockedLanes: Object.entries(report.topBlockedLanes).slice(0, 12),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
