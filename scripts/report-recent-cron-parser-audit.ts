import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyListing } from "@/lib/pipeline";
import { parseListingOptions } from "@/lib/option-parser";
import { CATALOG, ruleMatch, type Sku } from "@/lib/catalog";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type RawRow = {
  pid: number;
  name: string;
  price: number;
  query: string | null;
  detail_status: string | null;
  listing_state: string | null;
  listing_type: string | null;
  sku_id: string | null;
  sku_name: string | null;
  description_preview: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  detail_enriched_at: string | null;
  source_uploaded_at: string | null;
  source_updated_at: string | null;
  pool_eligible?: boolean | null;
  score_dirty?: boolean | null;
};

type ParsedRow = {
  pid: number;
  parser_version: string | null;
  category: string | null;
  family: string | null;
  model: string | null;
  comparable_key: string | null;
  parse_confidence: number | null;
  needs_review: boolean | null;
  storage_gb: number | null;
  ram_gb: number | null;
  ssd_gb: number | null;
  screen_size_in: number | null;
  chip: string | null;
  release_year: number | null;
  connectivity: string | null;
  parsed_json: Record<string, unknown> | null;
  parsed_at: string | null;
};

type PoolRow = {
  pid: number;
  status?: string | null;
};

type ReplayRow = {
  pid: number;
  title: string;
  query: string;
  price: number;
  rawSkuId: string | null;
  dbCategory: string | null;
  dbKey: string | null;
  dbNeedsReview: boolean | null;
  dbParserVersion: string | null;
  replaySkuId: string | null;
  replayCategory: string | null;
  replayKey: string | null;
  replayNeedsReview: boolean;
  replayConfidence: number;
  replayUnknownParts: string[];
  replayCriticalUnknown: string[];
  listingType: string;
  reasons: string[];
  firstSeenAt: string | null;
  parsedAt: string | null;
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
  } catch {}
}

function arg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchAll<T>(pathOrUrl: string): Promise<T[]> {
  const res = await restFetch(pathOrUrl, { headers: serviceHeaders() });
  return (await res.json()) as T[];
}

async function fetchRecentRaw(sinceIso: string, limit: number) {
  const select = [
    "pid",
    "name",
    "price",
    "query",
    "detail_status",
    "listing_state",
    "listing_type",
    "sku_id",
    "sku_name",
    "description_preview",
    "first_seen_at",
    "last_seen_at",
    "detail_enriched_at",
    "source_uploaded_at",
    "source_updated_at",
    "pool_eligible",
    "score_dirty",
  ].join(",");
  const rows: RawRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < limit; offset += pageSize) {
    const currentLimit = Math.min(pageSize, limit - offset);
    const url = `${tableUrl("mvp_raw_listings")}?select=${select}&first_seen_at=gte.${encodeURIComponent(sinceIso)}&order=first_seen_at.desc&limit=${currentLimit}&offset=${offset}`;
    const page = await fetchAll<RawRow>(url);
    rows.push(...page);
    if (page.length < currentLimit) break;
  }
  return rows;
}

async function fetchParsedByPid(pids: number[]) {
  const rows: ParsedRow[] = [];
  const select = [
    "pid",
    "parser_version",
    "category",
    "family",
    "model",
    "comparable_key",
    "parse_confidence",
    "needs_review",
    "storage_gb",
    "ram_gb",
    "ssd_gb",
    "screen_size_in",
    "chip",
    "release_year",
    "connectivity",
    "parsed_json",
    "parsed_at",
  ].join(",");
  for (const part of chunk(pids, 200)) {
    const url = `${tableUrl("mvp_listing_parsed")}?select=${select}&pid=in.(${part.join(",")})&limit=${part.length}`;
    rows.push(...await fetchAll<ParsedRow>(url));
  }
  return rows;
}

async function fetchPoolByPid(pids: number[]) {
  const rows: PoolRow[] = [];
  for (const part of chunk(pids, 200)) {
    const url = `${tableUrl("mvp_candidate_pool")}?select=pid,status&pid=in.(${part.join(",")})&limit=${part.length}`;
    rows.push(...await fetchAll<PoolRow>(url));
  }
  return rows;
}

function inc(map: Record<string, number>, key: string | null | undefined, by = 1) {
  map[key || "null"] = (map[key || "null"] ?? 0) + by;
}

function arr(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function samplePush<T>(list: T[], value: T, max = 12) {
  if (list.length < max) list.push(value);
}

function hasTechSignal(row: RawRow, parsed?: ParsedRow) {
  const text = `${row.query ?? ""} ${row.name} ${row.description_preview ?? ""}`.toLowerCase();
  const category = parsed?.category ?? "";
  return [
    "laptop",
    "tablet",
    "monitor",
    "speaker",
    "game_console",
    "desktop",
    "home_appliance",
    "camera",
    "smartphone",
    "earphone",
  ].includes(category) || /맥북|macbook|아이패드|ipad|ps5|플스|닌텐도|switch|모니터|monitor|jbl|보스|bose|sony|wh-1000|맥미니|아이맥|맥스튜디오|dyson|다이슨|roborock|로보락|카메라|canon|sony a7|갤럭시|iphone|아이폰/.test(text);
}

function replay(row: RawRow, parsed?: ParsedRow): ReplayRow {
  const detailText = row.description_preview ?? "";
  const classified = classifyListing(row.name, detailText, row.price);
  const matched = ruleMatch(row.name, detailText);
  const sku = matched ?? (row.sku_id ? CATALOG.find((item) => item.id === row.sku_id) ?? null : null);
  const category = (sku?.category ?? parsed?.category ?? null) as Sku["category"] | null;
  const out = parseListingOptions({
    title: row.name,
    description: detailText,
    category,
    skuId: sku?.id ?? row.sku_id ?? undefined,
    skuName: sku?.modelName ?? row.sku_name ?? undefined,
  });
  const reasons: string[] = [];
  if (!parsed) reasons.push("missing_db_parsed");
  if (parsed?.parser_version && !parsed.parser_version.includes("v32")) reasons.push(`stale_parser:${parsed.parser_version}`);
  if ((parsed?.comparable_key ?? null) !== (out.comparableKey ?? null)) reasons.push("db_key_differs_from_v31_replay");
  if (Boolean(parsed?.needs_review) !== out.needsReview) reasons.push("db_needs_review_differs_from_v31_replay");
  if (classified.listingType !== "normal") reasons.push(`classified_${classified.listingType}`);
  if (!out.comparableKey) reasons.push("v31_missing_comparable_key");
  if (out.needsReview) reasons.push("v31_needs_review");
  return {
    pid: row.pid,
    title: row.name,
    query: row.query ?? "",
    price: row.price,
    rawSkuId: row.sku_id,
    dbCategory: parsed?.category ?? null,
    dbKey: parsed?.comparable_key ?? null,
    dbNeedsReview: parsed?.needs_review ?? null,
    dbParserVersion: parsed?.parser_version ?? null,
    replaySkuId: sku?.id ?? null,
    replayCategory: sku?.category ?? parsed?.category ?? null,
    replayKey: out.comparableKey ?? null,
    replayNeedsReview: out.needsReview,
    replayConfidence: out.parseConfidence,
    replayUnknownParts: arr(out.parsedJson.unknown_parts),
    replayCriticalUnknown: arr(out.parsedJson.critical_unknown),
    listingType: classified.listingType,
    reasons,
    firstSeenAt: row.first_seen_at,
    parsedAt: parsed?.parsed_at ?? null,
  };
}

function statusGroup(row: ReplayRow) {
  if (row.reasons.includes("missing_db_parsed")) return "missing_parsed";
  if (row.reasons.some((reason) => reason.startsWith("stale_parser:")) || row.reasons.includes("db_key_differs_from_v31_replay") || row.reasons.includes("db_needs_review_differs_from_v31_replay")) return "stale_or_backfill_needed";
  if (row.listingType !== "normal") return "classified_hold";
  if (row.replayNeedsReview || !row.replayKey) return "v32_parser_gap_or_policy_review";
  return "v32_clean";
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await mkdir(reportsDir, { recursive: true });

  const windowHours = Number(arg("window-hours", "6"));
  const limit = Number(arg("limit", "5000"));
  const sinceIso = hoursAgo(windowHours);
  const rawRows = await fetchRecentRaw(sinceIso, limit);
  const parsedRows = await fetchParsedByPid(rawRows.map((row) => row.pid));
  const poolRows = await fetchPoolByPid(rawRows.map((row) => row.pid));
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));
  const poolPids = new Set(poolRows.map((row) => Number(row.pid)));

  const techRows = rawRows.filter((row) => hasTechSignal(row, parsedByPid.get(row.pid)));
  const replayRows = techRows.map((row) => replay(row, parsedByPid.get(row.pid)));

  const summary = {
    rawRecentRows: rawRows.length,
    techSignalRows: techRows.length,
    parsedRows: parsedRows.length,
    missingParsedRows: rawRows.length - parsedRows.length,
    candidatePoolRowsAmongRecent: poolRows.length,
    byRawQuery: {} as Record<string, number>,
    byDetailStatus: {} as Record<string, number>,
    byListingState: {} as Record<string, number>,
    byDbCategory: {} as Record<string, number>,
    byDbParserVersion: {} as Record<string, number>,
    byReplayCategory: {} as Record<string, number>,
    byStatusGroup: {} as Record<string, number>,
    byCriticalUnknown: {} as Record<string, number>,
  };

  for (const row of rawRows) {
    inc(summary.byRawQuery, row.query);
    inc(summary.byDetailStatus, row.detail_status);
    inc(summary.byListingState, row.listing_state);
  }
  for (const row of parsedRows) {
    inc(summary.byDbCategory, row.category);
    inc(summary.byDbParserVersion, row.parser_version);
  }
  for (const row of replayRows) {
    inc(summary.byReplayCategory, row.replayCategory);
    inc(summary.byStatusGroup, statusGroup(row));
    for (const unknown of row.replayCriticalUnknown) inc(summary.byCriticalUnknown, unknown);
  }

  const samples = {
    poolRiskRows: [] as ReplayRow[],
    staleOrBackfillNeeded: [] as ReplayRow[],
    v31ParserGapOrPolicyReview: [] as ReplayRow[],
    macbookRows: [] as ReplayRow[],
    ipadRows: [] as ReplayRow[],
    ps5Rows: [] as ReplayRow[],
    wave57QueryRows: [] as ReplayRow[],
  };

  for (const row of replayRows) {
    const text = `${row.query} ${row.title}`.toLowerCase();
    if (poolPids.has(row.pid) && statusGroup(row) !== "v32_clean") samplePush(samples.poolRiskRows, row);
    if (statusGroup(row) === "stale_or_backfill_needed") samplePush(samples.staleOrBackfillNeeded, row);
    if (statusGroup(row) === "v32_parser_gap_or_policy_review") samplePush(samples.v31ParserGapOrPolicyReview, row);
    if (/맥북|macbook/.test(text)) samplePush(samples.macbookRows, row, 20);
    if (/아이패드|ipad/.test(text)) samplePush(samples.ipadRows, row, 20);
    if (/ps5|플스5|플레이스테이션5/.test(text)) samplePush(samples.ps5Rows, row, 20);
    if (/보스 qc|bose qc|wh-1000xm|소니 헤드폰|맥미니|아이맥|맥스튜디오/.test(text)) samplePush(samples.wave57QueryRows, row, 20);
  }

  const queryRows = Object.entries(summary.byRawQuery)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([query, count]) => ({ query, count }));

  const output = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    dbMutation: false,
    windowHours,
    sinceIso,
    summary,
    topQueries: queryRows,
    samples,
    interpretation: [
      "stale_or_backfill_needed means current v31 replay disagrees with stored DB parsing; this is a reparse/backfill issue, not necessarily a parser code gap.",
      "v32_parser_gap_or_policy_review means the current parser still routes the row to needs_review/missing comparable key or policy hold.",
      "poolRiskRows are recent candidate_pool rows whose current replay is not v32_clean; these should be inspected before public promotion.",
    ],
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await writeFile(path.join(reportsDir, `recent-cron-parser-audit-${stamp}.json`), `${JSON.stringify(output, null, 2)}\n`);
  await writeFile(path.join(reportsDir, "recent-cron-parser-audit-latest.json"), `${JSON.stringify(output, null, 2)}\n`);

  const md = [
    "# Recent Cron Parser Audit",
    "",
    `- generatedAt: ${output.generatedAt}`,
    `- windowHours: ${windowHours}`,
    `- rawRecentRows: ${summary.rawRecentRows}`,
    `- techSignalRows: ${summary.techSignalRows}`,
    `- parsedRows: ${summary.parsedRows}`,
    `- missingParsedRows: ${summary.missingParsedRows}`,
    `- candidatePoolRowsAmongRecent: ${summary.candidatePoolRowsAmongRecent}`,
    "",
    "## Status Groups",
    "",
    "| group | rows |",
    "|---|---:|",
    ...Object.entries(summary.byStatusGroup).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`),
    "",
    "## Detail Status",
    "",
    "| detail_status | rows |",
    "|---|---:|",
    ...Object.entries(summary.byDetailStatus).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`),
    "",
    "## DB Categories",
    "",
    "| category | rows |",
    "|---|---:|",
    ...Object.entries(summary.byDbCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`),
    "",
    "## Critical Unknowns (v31 replay)",
    "",
    "| unknown | rows |",
    "|---|---:|",
    ...Object.entries(summary.byCriticalUnknown).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`),
    "",
    "## Top Queries",
    "",
    "| query | rows |",
    "|---|---:|",
    ...queryRows.map((row) => `| ${row.query || "(blank)"} | ${row.count} |`),
    "",
    "## Pool Risk Samples",
    "",
    "| pid | query | dbKey | replayKey | reasons | title |",
    "|---:|---|---|---|---|---|",
    ...samples.poolRiskRows.map((row) => `| ${row.pid} | ${row.query} | ${row.dbKey ?? "-"} | ${row.replayKey ?? "-"} | ${row.reasons.join(", ")} | ${row.title.replaceAll("|", "/")} |`),
    "",
    "## v31 Parser Gap / Policy Review Samples",
    "",
    "| pid | query | replayKey | unknown | reasons | title |",
    "|---:|---|---|---|---|---|",
    ...samples.v31ParserGapOrPolicyReview.map((row) => `| ${row.pid} | ${row.query} | ${row.replayKey ?? "-"} | ${[...row.replayCriticalUnknown, ...row.replayUnknownParts].join(", ")} | ${row.reasons.join(", ")} | ${row.title.replaceAll("|", "/")} |`),
    "",
    "## MacBook Samples",
    "",
    "| pid | query | dbKey | replayKey | dbVersion | reasons | title |",
    "|---:|---|---|---|---|---|---|",
    ...samples.macbookRows.map((row) => `| ${row.pid} | ${row.query} | ${row.dbKey ?? "-"} | ${row.replayKey ?? "-"} | ${row.dbParserVersion ?? "-"} | ${row.reasons.join(", ")} | ${row.title.replaceAll("|", "/")} |`),
    "",
  ];
  await writeFile(path.join(reportsDir, `recent-cron-parser-audit-${stamp}.md`), `${md.join("\n")}\n`);
  await writeFile(path.join(reportsDir, "recent-cron-parser-audit-latest.md"), `${md.join("\n")}\n`);
  console.log(JSON.stringify({
    generatedAt: output.generatedAt,
    windowHours,
    rawRecentRows: summary.rawRecentRows,
    techSignalRows: summary.techSignalRows,
    statusGroups: summary.byStatusGroup,
    criticalUnknowns: summary.byCriticalUnknown,
    poolRiskSamples: samples.poolRiskRows.length,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
