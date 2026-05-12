import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseGameConsoleListing } from "@/lib/game-console-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

const SEARCH_TERMS = [
  "닌텐도 스위치",
  "닌텐도 스위치 oled",
  "닌텐도 스위치 라이트",
  "닌텐도 스위치2",
  "switch 2",
  "스위치 본체",
  "스위치 oled",
  "스위치 라이트",
  "ps5",
  "플스5",
  "플레이스테이션5",
  "ps5 디스크",
  "ps5 디지털",
  "ps5 슬림",
  "ps5 pro",
  "xbox series x",
  "xbox series s",
  "스팀덱",
  "steam deck",
];

const REVIEW_MODELS = new Set([
  "nintendo_switch_2",
  "nintendo_switch_unknown",
  "playstation_5_unknown_edition",
]);

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
  const res = await fetch(`${supabaseBaseUrl()}/rest/v1${pathname}`, {
    headers: serviceHeaders(),
    signal: AbortSignal.timeout(20_000),
  });
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

function compact(text: unknown, limit = 72) {
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
  const parsed = parseGameConsoleListing(title, description, row.price ?? 0);
  const modelNeedsReview = parsed.model ? REVIEW_MODELS.has(parsed.model) : false;
  let decision: RuntimeDecision;
  if (!parsed.platform || !parsed.model) {
    decision = "out_of_scope";
  } else if (parsed.listingType === "normal" && parsed.comparableKey && !parsed.needsReview && !modelNeedsReview) {
    decision = "candidate_positive";
  } else if (parsed.listingType === "normal" || parsed.needsReview || modelNeedsReview) {
    decision = "manual_review";
  } else {
    decision = "negative_hold";
  }

  const riskFlags = [
    modelNeedsReview ? "review_model_or_edition" : null,
    parsed.bundleRisk ? "bundle_risk" : null,
    parsed.moddedOrDamaged ? "modded_or_damaged" : null,
    parsed.bodyConfig === "unknown_body" ? "unknown_body_config" : null,
    parsed.listingType !== "normal" ? `listing_type_${parsed.listingType}` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    pid: row.pid,
    title,
    price: row.price,
    listingType: parsed.listingType,
    platform: parsed.platform,
    model: parsed.model,
    edition: parsed.edition,
    bodyConfig: parsed.bodyConfig,
    comparableKey: parsed.comparableKey,
    needsReview: parsed.needsReview,
    parseConfidence: parsed.parseConfidence,
    decision,
    riskFlags,
    reasons: parsed.reasons,
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
    .slice(0, 800);
  const resultRows = sampledRows.map(rowDecision);
  const candidateRows = resultRows.filter((row) => row.decision === "candidate_positive");
  const manualRows = resultRows.filter((row) => row.decision === "manual_review");
  const holdRows = resultRows.filter((row) => row.decision === "negative_hold");
  const candidateRiskRows = candidateRows.filter((row) => row.riskFlags.length > 0);

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "game_console_body_narrow",
    scope: "real raw active/detail-done sampling for game console body-narrow no-mutation scope",
    searchTerms: SEARCH_TERMS,
    fetchedByTerm,
    metrics: {
      rawRows: sampledRows.length,
      candidatePositiveRows: candidateRows.length,
      manualReviewRows: manualRows.length,
      negativeHoldRows: holdRows.length,
      outOfScopeRows: resultRows.filter((row) => row.decision === "out_of_scope").length,
      candidateRiskRows: candidateRiskRows.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    byDecision: countBy(resultRows, (row) => row.decision),
    byListingType: countBy(resultRows, (row) => row.listingType),
    byModel: countBy(resultRows, (row) => row.model ?? "unknown"),
    byBodyConfig: countBy(resultRows, (row) => row.bodyConfig),
    candidateRows: candidateRows.slice(0, 60),
    candidateRiskRows,
    manualRows: manualRows.slice(0, 80),
    holdRows: holdRows.slice(0, 80),
    conclusion: candidateRiskRows.length > 0
      ? "game_console_real_raw_candidate_risk_review_required"
      : "game_console_real_raw_scope_no_candidate_risk_found",
    nextAction: candidateRiskRows.length > 0
      ? "Review candidateRiskRows before any runtime/public wiring; keep report-only."
      : "Use this as the no-mutation baseline before any owner-approved game-console runtime review.",
  };

  const jsonPath = path.join(reportsDir, "game-console-real-raw-scope-latest.json");
  const mdPath = path.join(reportsDir, "game-console-real-raw-scope-latest.md");

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Game Console Real Raw Scope",
    "",
    `- generatedAt: ${generatedAt}`,
    `- category: ${report.category}`,
    `- conclusion: ${report.conclusion}`,
    "",
    "## Boundary",
    "",
    "- reportOnly: true",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    "- productionDbMutation: false",
    "- directThirtyDayPlanEdit: false",
    "",
    "## Metrics",
    "",
    `- rawRows: ${report.metrics.rawRows}`,
    `- candidatePositiveRows: ${report.metrics.candidatePositiveRows}`,
    `- manualReviewRows: ${report.metrics.manualReviewRows}`,
    `- negativeHoldRows: ${report.metrics.negativeHoldRows}`,
    `- outOfScopeRows: ${report.metrics.outOfScopeRows}`,
    `- candidateRiskRows: ${report.metrics.candidateRiskRows}`,
    "",
    "## Decision Counts",
    "",
    mdTable(["decision", "count"], Object.entries(report.byDecision)),
    "",
    "## Listing Type Counts",
    "",
    mdTable(["listingType", "count"], Object.entries(report.byListingType)),
    "",
    "## Model Counts",
    "",
    mdTable(["model", "count"], Object.entries(report.byModel).slice(0, 20)),
    "",
    "## Candidate Positive Rows",
    "",
    mdTable(
      ["pid", "title", "price", "model", "body", "key", "confidence"],
      report.candidateRows.slice(0, 30).map((row) => [
        row.pid,
        compact(row.title),
        row.price ?? "-",
        row.model ?? "-",
        row.bodyConfig,
        row.comparableKey ?? "-",
        row.parseConfidence,
      ]),
    ),
    "",
    "## Candidate Risk Rows",
    "",
    report.candidateRiskRows.length
      ? mdTable(
        ["pid", "title", "decision", "riskFlags", "reasons"],
        report.candidateRiskRows.map((row) => [
          row.pid,
          compact(row.title),
          row.decision,
          row.riskFlags.join(", "),
          row.reasons.join(", "),
        ]),
      )
      : "- none",
    "",
    "## Manual Review Sample",
    "",
    mdTable(
      ["pid", "title", "model", "body", "needsReview", "reasons"],
      report.manualRows.slice(0, 30).map((row) => [
        row.pid,
        compact(row.title),
        row.model ?? "-",
        row.bodyConfig,
        row.needsReview,
        row.reasons.join(", "),
      ]),
    ),
    "",
    "## Next Action",
    "",
    `- ${report.nextAction}`,
    "",
  ].join("\n");

  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    conclusion: report.conclusion,
    rawRows: report.metrics.rawRows,
    candidatePositiveRows: report.metrics.candidatePositiveRows,
    manualReviewRows: report.metrics.manualReviewRows,
    candidateRiskRows: report.metrics.candidateRiskRows,
    jsonPath,
    mdPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
