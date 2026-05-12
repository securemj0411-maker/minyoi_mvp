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
  "소니 xm5",
  "소니 xm4",
  "소니 xm3",
  "소니 xm6",
  "wh-1000xm5",
  "wh-1000xm4",
  "wh-1000xm3",
  "wh-1000xm6",
  "wh-ch720n",
  "ch720n",
  "wh-ch520",
  "ch520",
  "ult wear",
  "ult900n",
  "보스 qc 울트라",
  "qc ultra",
  "보스 qc45",
  "qc45",
  "비츠 솔로4",
  "beats solo4",
  "젠하이저 accentum",
  "젠하이저 hd569",
  "헤드폰",
  "헤드셋",
];

const TARGET_SKUS = new Set([
  "sony-wh-1000xm5",
  "sony-wh-1000xm4",
  "sony-wh-1000xm3",
  "sony-wh-1000xm6",
  "sony-wh-ult900n",
  "sony-wh-ch720n",
  "sony-wh-ch520",
  "bose-qc-ultra",
  "bose-qc45",
  "beats-solo4",
  "sennheiser-accentum",
  "sennheiser-hd569",
]);

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

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function compact(text: unknown, limit = 60) {
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

function rowDecision(row: RawListingRow) {
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
  const accessoryOnlyTitle = ACCESSORY_ONLY_TITLE_PATTERNS.some((pattern) => pattern.test(normalize(title)));
  const riskFlags = [
    accessoryOnlyTitle ? "accessory_only_title_pattern" : null,
    skuId === "airpods-max" ? "airpods_max_excluded_from_non_airpods_scope" : null,
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
    runtimeListingType: classified.listingType,
    runtimeSkuId: classified.sku?.id ?? null,
    ruleMatchSkuId: matchedSku?.id ?? null,
    comparableKey: parsed.comparableKey,
    needsReview: parsed.needsReview,
    parseConfidence: parsed.parseConfidence,
    decision,
    riskFlags,
    lastSeenAt: row.last_seen_at,
    url: row.url,
  };
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const fetchedByTerm: Record<string, number> = {};
  const rowsByPid = new Map<number, RawListingRow>();
  for (const term of SEARCH_TERMS) {
    const rows = await restJson<RawListingRow[]>(titleTermQuery(term, 80));
    fetchedByTerm[term] = rows.length;
    for (const row of rows) rowsByPid.set(row.pid, row);
  }

  const generatedAt = new Date().toISOString();
  const sampledRows = [...rowsByPid.values()]
    .sort((a, b) => String(b.last_seen_at ?? "").localeCompare(String(a.last_seen_at ?? "")))
    .slice(0, 600);
  const resultRows = sampledRows.map(rowDecision);
  const candidateRows = resultRows.filter((row) => row.decision === "candidate_positive");
  const candidateRiskRows = candidateRows.filter((row) => row.riskFlags.includes("accessory_only_title_pattern"));
  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    category: "headphone_discovered",
    scope: "non-AirPods real raw read-only runtime scope",
    searchTerms: SEARCH_TERMS,
    fetchedByTerm,
    metrics: {
      rawFetchedUnique: sampledRows.length,
      candidatePositive: candidateRows.length,
      manualReview: resultRows.filter((row) => row.decision === "manual_review").length,
      negativeHold: resultRows.filter((row) => row.decision === "negative_hold").length,
      outOfScope: resultRows.filter((row) => row.decision === "out_of_scope").length,
      candidateRiskRows: candidateRiskRows.length,
      uniqueCandidateSkus: Object.keys(countBy(candidateRows, (row) => row.runtimeSkuId ?? row.ruleMatchSkuId ?? "unknown")).length,
    },
    byDecision: countBy(resultRows, (row) => row.decision),
    bySku: countBy(resultRows, (row) => row.runtimeSkuId ?? row.ruleMatchSkuId ?? "unknown"),
    candidateBySku: countBy(candidateRows, (row) => row.runtimeSkuId ?? row.ruleMatchSkuId ?? "unknown"),
    candidateByComparableKey: countBy(candidateRows, (row) => row.comparableKey ?? "null"),
    candidateRiskRows,
    candidateRows: candidateRows.slice(0, 120),
    manualRows: resultRows.filter((row) => row.decision === "manual_review").slice(0, 80),
    negativeRows: resultRows.filter((row) => row.decision === "negative_hold").slice(0, 80),
    outOfScopeRows: resultRows.filter((row) => row.decision === "out_of_scope").slice(0, 80),
    decision:
      candidateRows.length >= 30 && candidateRiskRows.length === 0 && Object.keys(countBy(candidateRows, (row) => row.runtimeSkuId ?? row.ruleMatchSkuId ?? "unknown")).length >= 3
        ? "non_airpods_headphone_scope_supports_next_internal_reparse_plan"
        : "non_airpods_headphone_scope_needs_more_sampling_or_guardrail_review",
    nextStep:
      candidateRows.length >= 30 && candidateRiskRows.length === 0
        ? "Build a no-mutation internal reparse scope plan by SKU, still without public promotion."
        : "Broaden source sampling or inspect out-of-scope/manual rows before any reparse scope plan.",
  };

  await writeFile(path.join(reportsDir, "headphone-non-airpods-real-raw-scope-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    "# Headphone Non-AirPods Real Raw Scope",
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
    `- uniqueCandidateSkus: ${report.metrics.uniqueCandidateSkus}`,
    "",
    "## Candidate by SKU",
    "",
    mdTable(["sku", "count"], Object.entries(report.candidateBySku)),
    "",
    "## Candidate Comparable Keys",
    "",
    mdTable(["comparableKey", "count"], Object.entries(report.candidateByComparableKey).slice(0, 30)),
    "",
    "## Candidate Sample",
    "",
    mdTable(
      ["pid", "title", "price", "sku", "comparableKey", "needsReview", "risk"],
      candidateRows.slice(0, 40).map((row) => [
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
    "## Manual Review Sample",
    "",
    mdTable(
      ["pid", "title", "sku", "comparableKey", "needsReview", "risk"],
      report.manualRows.slice(0, 30).map((row) => [
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
  await writeFile(path.join(reportsDir, "headphone-non-airpods-real-raw-scope-latest.md"), `${md}\n`);
  console.log(`headphone non-AirPods scope: raw=${report.metrics.rawFetchedUnique}, candidate=${report.metrics.candidatePositive}, skus=${report.metrics.uniqueCandidateSkus}, risk=${report.metrics.candidateRiskRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
