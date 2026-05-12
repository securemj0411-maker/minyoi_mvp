import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ruleMatch } from "@/lib/catalog";
import { normalize } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

const SEARCH_TERMS = [
  "에어팟맥스",
  "에어팟 맥스",
  "airpods max",
  "airpod max",
  "wh-1000xm5",
  "xm5",
  "qc ultra",
  "qc울트라",
  "qc 울트라",
  "wh-ch520",
  "ch520",
  "헤드폰",
  "헤드셋",
];

const TARGET_SKUS = new Set([
  "airpods-max",
  "sony-wh-1000xm5",
  "sony-wh-ch520",
  "bose-qc-ultra",
]);

const ACCESSORY_RISK_TOKENS = [
  "케이스",
  "case",
  "파우치",
  "pouch",
  "이어패드",
  "이어 패드",
  "이어쿠션",
  "이어 쿠션",
  "헤드쿠션",
  "헤드 쿠션",
  "커버",
  "스탠드",
  "거치대",
  "케이블",
  "충전기",
];

const ACCESSORY_ONLY_TITLE_PATTERNS = [
  /(케이스|case|파우치|pouch|이어패드|이어\s*패드|이어쿠션|이어\s*쿠션|헤드쿠션|헤드\s*쿠션|커버|스탠드|거치대|케이블|충전기)\s*(만|단품|판매|팝니다|팔아요|급처)?$/,
  /(케이스만|파우치만|이어패드만|이어\s*패드만|이어쿠션만|이어\s*쿠션만|헤드쿠션만|헤드\s*쿠션만|커버만|스탠드만|거치대만|케이블만|충전기만)/,
];

type RawListingRow = {
  pid: number;
  name: string | null;
  price: number | null;
  description_preview: string | null;
  listing_state: string | null;
  detail_status: string | null;
  listing_type: string | null;
  sku_id: string | null;
  sku_name: string | null;
  last_seen_at: string | null;
  detail_enriched_at: string | null;
  url: string | null;
};

type RuntimeDecision = "candidate_positive" | "manual_review" | "negative_hold" | "out_of_scope";

type ScopeRow = {
  pid: number;
  title: string;
  price: number | null;
  listingState: string | null;
  rawListingType: string | null;
  runtimeListingType: string;
  runtimeSkuId: string | null;
  ruleMatchSkuId: string | null;
  comparableKey: string | null;
  needsReview: boolean;
  parseConfidence: number;
  decision: RuntimeDecision;
  riskFlags: string[];
  lastSeenAt: string | null;
  detailEnrichedAt: string | null;
  url: string | null;
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
  } catch {
    // optional env file
  }
}

function supabaseBaseUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL required");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY required");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
  };
}

async function restJson<T>(pathname: string): Promise<T> {
  const res = await fetch(`${supabaseBaseUrl()}/rest/v1${pathname}`, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

function titleTermQuery(term: string, limit: number) {
  const select = [
    "pid",
    "name",
    "price",
    "description_preview",
    "listing_state",
    "detail_status",
    "listing_type",
    "sku_id",
    "sku_name",
    "last_seen_at",
    "detail_enriched_at",
    "url",
  ].join(",");
  return `/mvp_raw_listings?select=${select}&name=ilike.*${encodeURIComponent(term)}*&listing_state=eq.active&detail_status=eq.done&order=last_seen_at.desc.nullslast&limit=${limit}`;
}

function hasAny(text: string, tokens: string[]) {
  const n = normalize(text);
  return tokens.filter((token) => n.includes(normalize(token)));
}

function runtimeDecision(row: RawListingRow): ScopeRow {
  const title = row.name ?? "";
  const description = row.description_preview ?? "";
  const classified = classifyListing(title, description, row.price ?? 0);
  const matchedSku = ruleMatch(title, description);
  const parserSku = classified.sku ?? matchedSku;
  const parsed = parseListingOptions({
    title,
    description,
    category: "earphone",
    skuId: parserSku?.id ?? null,
    skuName: parserSku?.modelName ?? null,
  });
  const skuId = classified.sku?.id ?? matchedSku?.id ?? null;
  const targetSku = skuId ? TARGET_SKUS.has(skuId) : false;
  const titleAccessoryHits = hasAny(title, ACCESSORY_RISK_TOKENS);
  const descriptionAccessoryHits = hasAny(description, ACCESSORY_RISK_TOKENS);
  const accessoryOnlyTitle = ACCESSORY_ONLY_TITLE_PATTERNS.some((pattern) => pattern.test(normalize(title)));
  const riskFlags = [
    accessoryOnlyTitle ? "accessory_only_title_pattern" : null,
    ...titleAccessoryHits.map((hit) => `title_accessory_token:${hit}`),
    ...descriptionAccessoryHits.slice(0, 4).map((hit) => `description_accessory_token:${hit}`),
    row.listing_state && row.listing_state !== "active" ? `raw_state:${row.listing_state}` : null,
    row.detail_status && row.detail_status !== "done" ? `detail_status:${row.detail_status}` : null,
    !targetSku && skuId ? `non_target_sku:${skuId}` : null,
    !skuId ? "no_sku_match" : null,
  ].filter((value): value is string => Boolean(value));

  let decision: RuntimeDecision;
  if (!targetSku) {
    decision = "out_of_scope";
  } else if (classified.listingType === "normal" && parsed.comparableKey && !parsed.needsReview) {
    decision = "candidate_positive";
  } else if (classified.listingType === "normal") {
    decision = "manual_review";
  } else {
    decision = "negative_hold";
  }

  return {
    pid: row.pid,
    title,
    price: row.price,
    listingState: row.listing_state,
    rawListingType: row.listing_type,
    runtimeListingType: classified.listingType,
    runtimeSkuId: classified.sku?.id ?? null,
    ruleMatchSkuId: matchedSku?.id ?? null,
    comparableKey: parsed.comparableKey,
    needsReview: parsed.needsReview,
    parseConfidence: parsed.parseConfidence,
    decision,
    riskFlags,
    lastSeenAt: row.last_seen_at,
    detailEnrichedAt: row.detail_enriched_at,
    url: row.url,
  };
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function compact(text: unknown, limit = 52) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
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
  await mkdir(reportsDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const fetchedByTerm: Record<string, number> = {};
  const rowsByPid = new Map<number, RawListingRow>();
  for (const term of SEARCH_TERMS) {
    const rows = await restJson<RawListingRow[]>(titleTermQuery(term, 80));
    fetchedByTerm[term] = rows.length;
    for (const row of rows) rowsByPid.set(row.pid, row);
  }

  const sampledRows = [...rowsByPid.values()]
    .sort((a, b) => String(b.last_seen_at ?? "").localeCompare(String(a.last_seen_at ?? "")))
    .slice(0, 500);
  const resultRows = sampledRows.map(runtimeDecision);
  const candidateRows = resultRows.filter((row) => row.decision === "candidate_positive");
  const candidateRiskRows = candidateRows.filter((row) => row.riskFlags.some((flag) => flag === "accessory_only_title_pattern" || flag.startsWith("raw_state")));
  const candidateAdvisoryRows = candidateRows.filter((row) => row.riskFlags.length > 0 && !candidateRiskRows.includes(row));
  const manualRows = resultRows.filter((row) => row.decision === "manual_review");
  const negativeRows = resultRows.filter((row) => row.decision === "negative_hold");
  const outOfScopeRows = resultRows.filter((row) => row.decision === "out_of_scope");

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    category: "headphone_discovered",
    scope: "real raw mvp_raw_listings read-only runtime scope for matched headphone SKUs",
    searchTerms: SEARCH_TERMS,
    fetchedByTerm,
    metrics: {
      rawFetchedUnique: sampledRows.length,
      candidatePositive: candidateRows.length,
      manualReview: manualRows.length,
      negativeHold: negativeRows.length,
      outOfScope: outOfScopeRows.length,
      candidateRiskRows: candidateRiskRows.length,
      candidateAdvisoryRows: candidateAdvisoryRows.length,
    },
    byDecision: countBy(resultRows, (row) => row.decision),
    bySku: countBy(resultRows, (row) => row.runtimeSkuId ?? row.ruleMatchSkuId ?? "unknown"),
    byComparableKey: countBy(candidateRows, (row) => row.comparableKey ?? "null"),
    candidateRiskRows,
    candidateAdvisoryRows: candidateAdvisoryRows.slice(0, 80),
    candidateRows: candidateRows.slice(0, 80),
    manualRows: manualRows.slice(0, 80),
    negativeRows: negativeRows.slice(0, 80),
    outOfScopeExamples: outOfScopeRows.slice(0, 40),
    decision:
      candidateRows.length >= 10 && candidateRiskRows.length === 0
        ? "headphone_real_raw_scope_supports_internal_no_mutation_reparse_design"
        : "headphone_real_raw_scope_needs_more_sampling_or_guardrail_review_before_reparse",
    nextStep:
      candidateRows.length >= 10 && candidateRiskRows.length === 0
        ? "Design a small no-mutation reparse/backfill candidate set for headphone_discovered; keep public promotion closed."
        : "Inspect candidate risk/manual rows before any reparse/backfill design; keep runtime/public/pool wiring closed.",
  };

  await writeFile(path.join(reportsDir, "headphone-real-raw-runtime-scope-latest.json"), `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Headphone Real Raw Runtime Scope",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision}`,
    "",
    "## Metrics",
    "",
    `- rawFetchedUnique: ${report.metrics.rawFetchedUnique}`,
    `- candidatePositive: ${report.metrics.candidatePositive}`,
    `- manualReview: ${report.metrics.manualReview}`,
    `- negativeHold: ${report.metrics.negativeHold}`,
    `- outOfScope: ${report.metrics.outOfScope}`,
    `- candidateRiskRows: ${report.metrics.candidateRiskRows}`,
    `- candidateAdvisoryRows: ${report.metrics.candidateAdvisoryRows}`,
    "",
    "## By Decision",
    "",
    mdTable(["decision", "count"], Object.entries(report.byDecision)),
    "",
    "## By SKU",
    "",
    mdTable(["sku", "count"], Object.entries(report.bySku).slice(0, 20)),
    "",
    "## Candidate Comparable Keys",
    "",
    mdTable(["comparableKey", "count"], Object.entries(report.byComparableKey).slice(0, 20)),
    "",
    "## Candidate Positive Sample",
    "",
    mdTable(
      ["pid", "title", "price", "sku", "comparableKey", "needsReview", "riskFlags"],
      candidateRows.slice(0, 30).map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.runtimeSkuId ?? row.ruleMatchSkuId ?? "",
        row.comparableKey ?? "",
        row.needsReview,
        row.riskFlags.join(", "),
      ]),
    ),
    "",
    "## Candidate Risk Rows",
    "",
    candidateRiskRows.length
      ? mdTable(
          ["pid", "title", "decision", "sku", "riskFlags"],
          candidateRiskRows.slice(0, 30).map((row) => [
            row.pid,
            compact(row.title),
            row.decision,
            row.runtimeSkuId ?? row.ruleMatchSkuId ?? "",
            row.riskFlags.join(", "),
          ]),
        )
      : "- none",
    "",
    "## Candidate Advisory Rows",
    "",
    candidateAdvisoryRows.length
      ? mdTable(
          ["pid", "title", "decision", "sku", "riskFlags"],
          candidateAdvisoryRows.slice(0, 30).map((row) => [
            row.pid,
            compact(row.title),
            row.decision,
            row.runtimeSkuId ?? row.ruleMatchSkuId ?? "",
            row.riskFlags.join(", "),
          ]),
        )
      : "- none",
    "",
    "## Manual Review Sample",
    "",
    mdTable(
      ["pid", "title", "sku", "comparableKey", "needsReview", "riskFlags"],
      manualRows.slice(0, 30).map((row) => [
        row.pid,
        compact(row.title),
        row.runtimeSkuId ?? row.ruleMatchSkuId ?? "",
        row.comparableKey ?? "",
        row.needsReview,
        row.riskFlags.join(", "),
      ]),
    ),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "headphone-real-raw-runtime-scope-latest.md"), `${md}\n`);
  console.log(`headphone real raw scope: raw=${report.metrics.rawFetchedUnique}, candidate=${report.metrics.candidatePositive}, manual=${report.metrics.manualReview}, risk=${report.metrics.candidateRiskRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
