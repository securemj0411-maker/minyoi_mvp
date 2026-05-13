import fs from "node:fs";
import path from "node:path";

type ParsedRow = {
  pid: number;
  category: string | null;
  comparable_key: string | null;
  parse_confidence: number | null;
  needs_review: boolean | null;
  parsed_json: Record<string, unknown> | null;
};

type PidRow = { pid: number };

const appDir = process.cwd();
const reportDir = path.join(appDir, "reports");
const mdPath = path.join(reportDir, "ai-l2-parser-gap-dry-run-latest.md");
const jsonPath = path.join(reportDir, "ai-l2-parser-gap-dry-run-latest.json");
const pageSize = 1000;

async function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function restBase() {
  const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL is not configured");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function headers() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    prefer: "count=exact",
  };
}

async function restJson<T>(pathAndQuery: string): Promise<T[]> {
  const res = await fetch(`${restBase()}${pathAndQuery}`, { headers: headers() });
  if (!res.ok) throw new Error(`Supabase REST failed ${res.status}: ${await res.text()}`);
  return await res.json() as T[];
}

async function fetchAll<T>(pathAndQuery: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const joiner = pathAndQuery.includes("?") ? "&" : "?";
    const page = await restJson<T>(`${pathAndQuery}${joiner}limit=${pageSize}&offset=${offset}`);
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function parsedJson(row: ParsedRow) {
  const value = row.parsed_json;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function comparableUnknowns(row: ParsedRow) {
  const fromJson = stringArray(parsedJson(row).unknown_parts);
  if (fromJson.length > 0) return fromJson;
  return row.comparable_key?.split("|").filter((part) => part.startsWith("unknown_")) ?? [];
}

function criticalUnknowns(row: ParsedRow) {
  return stringArray(parsedJson(row).critical_unknown);
}

function ambiguityReason(row: ParsedRow) {
  const unknown = comparableUnknowns(row);
  const critical = criticalUnknowns(row);
  if (critical.length > 0) return "parser_critical_unknown";
  if (unknown.some((part) => /connectivity|carrier/.test(part))) return "connectivity_ambiguity";
  if (unknown.some((part) => /generation|gen/.test(part))) return "generation_ambiguity";
  if (unknown.length > 0) return "parser_unknown_option";
  if (row.needs_review) return "option_needs_review";
  const confidence = Number(row.parse_confidence ?? 0);
  if (confidence > 0 && confidence < 0.65) return "option_parse_review";
  return "not_parser_gap";
}

function increment(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function top(map: Map<string, number>, limit = 12) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function pct(num: number, den: number) {
  if (den <= 0) return 0;
  return Number(((num / den) * 100).toFixed(1));
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  fs.mkdirSync(reportDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const [
    parsedRows,
    listingsRows,
    aiCacheRows,
  ] = await Promise.all([
    fetchAll<ParsedRow>("/mvp_listing_parsed?select=pid,category,comparable_key,parse_confidence,needs_review,parsed_json"),
    fetchAll<PidRow>("/mvp_listings?select=pid"),
    fetchAll<PidRow>("/mvp_listing_ai_classifications?select=pid"),
  ]);

  const listingPids = new Set(listingsRows.map((row) => Number(row.pid)));
  const aiCachePids = new Set(aiCacheRows.map((row) => Number(row.pid)));
  const parserGapRows = parsedRows.filter((row) => ambiguityReason(row) !== "not_parser_gap");
  const needsReviewRows = parsedRows.filter((row) => row.needs_review === true);
  const categoryCounts = new Map<string, number>();
  const reasonCounts = new Map<string, number>();
  const unknownCounts = new Map<string, number>();
  for (const row of parserGapRows) {
    increment(categoryCounts, row.category ?? "unknown");
    increment(reasonCounts, ambiguityReason(row));
    for (const part of comparableUnknowns(row)) increment(unknownCounts, part);
    for (const part of criticalUnknowns(row)) increment(unknownCounts, `critical:${part}`);
  }

  const missingFromListings = needsReviewRows.filter((row) => !listingPids.has(Number(row.pid))).length;
  const cachedParserGapRows = parserGapRows.filter((row) => aiCachePids.has(Number(row.pid))).length;
  const tinyCap = Math.max(0, Number(process.env.AI_L2_ESCROW_DRY_RUN_CAP ?? 100));
  const dryRunCalls = Math.min(tinyCap, parserGapRows.length - cachedParserGapRows);
  const inputPerCall = Number(process.env.AI_L2_DRY_RUN_INPUT_TOKENS ?? 900);
  const outputPerCall = Number(process.env.AI_L2_DRY_RUN_OUTPUT_TOKENS ?? 180);
  const inputUsdPer1m = Number(process.env.OPENAI_CLASSIFIER_INPUT_USD_PER_1M ?? 0.4);
  const outputUsdPer1m = Number(process.env.OPENAI_CLASSIFIER_OUTPUT_USD_PER_1M ?? 1.6);
  const estimatedUsd = (dryRunCalls * inputPerCall * inputUsdPer1m / 1_000_000)
    + (dryRunCalls * outputPerCall * outputUsdPer1m / 1_000_000);

  const summary = {
    generatedAt,
    mode: "dry_run_no_ai_calls_no_db_mutation",
    counts: {
      parsedRows: parsedRows.length,
      parserGapRows: parserGapRows.length,
      needsReviewRows: needsReviewRows.length,
      needsReviewMissingFromListings: missingFromListings,
      existingAiCacheRows: aiCacheRows.length,
      parserGapRowsAlreadyCached: cachedParserGapRows,
      parserGapCacheHitPct: pct(cachedParserGapRows, parserGapRows.length),
      tinyCap,
      dryRunCalls,
      estimatedUsd: Number(estimatedUsd.toFixed(4)),
    },
    topCategories: top(categoryCounts),
    topReasons: top(reasonCounts),
    topUnknowns: top(unknownCounts),
    decision: {
      safeToEnableBroadAiL2: false,
      nextStep: "Use tiny cap after FK/cache migration review; keep pool-policy blocklist active.",
      why: "Parser-gap population is large enough that broad enablement would create uncontrolled AI calls and cache writes.",
    },
  };

  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  const md = [
    "# AI L2 Parser Gap Dry Run",
    "",
    `Generated: ${generatedAt}`,
    "",
    "No AI calls, DB mutations, DDL, public promotion, or candidate-pool changes were made.",
    "",
    "## Counts",
    "",
    mdTable(
      ["Metric", "Value"],
      Object.entries(summary.counts).map(([key, value]) => [key, value]),
    ),
    "",
    "## Top Categories",
    "",
    mdTable(["Category", "Rows"], summary.topCategories.map((row) => [row.key, row.count])),
    "",
    "## Top Reasons",
    "",
    mdTable(["Reason", "Rows"], summary.topReasons.map((row) => [row.key, row.count])),
    "",
    "## Top Unknown Parts",
    "",
    mdTable(["Unknown", "Rows"], summary.topUnknowns.map((row) => [row.key, row.count])),
    "",
    "## Decision",
    "",
    `- Safe to enable broad AI L2: ${summary.decision.safeToEnableBroadAiL2}`,
    `- Next: ${summary.decision.nextStep}`,
    `- Why: ${summary.decision.why}`,
    "",
  ].join("\n");
  fs.writeFileSync(mdPath, md);
  console.log(`wrote ${mdPath}`);
  console.log(`wrote ${jsonPath}`);
  console.table(summary.counts);
  console.table(summary.topReasons);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
