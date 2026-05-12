import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectSearchItems } from "@/lib/bunjang";
import { parseGameConsoleListing } from "@/lib/game-console-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

const QUERIES = [
  "닌텐도 스위치 OLED 본체",
  "닌텐도 스위치 OLED 풀박스",
  "닌텐도 스위치 라이트 본체",
  "닌텐도 스위치 본체 풀박스",
  "닌텐도 스위치 배터리 개선판",
  "닌텐도 스위치2 본체",
  "플스5 본체 디스크",
  "플스5 본체 디지털",
  "플스5 슬림 본체",
  "PS5 본체",
  "PS5 디스크 에디션",
  "PS5 디지털 에디션",
  "xbox series x 본체",
  "xbox series s 본체",
  "스팀덱 본체",
];

const REVIEW_MODELS = new Set([
  "nintendo_switch_2",
  "nintendo_switch_unknown",
  "playstation_5_unknown_edition",
]);

type Decision = "candidate_positive" | "manual_review" | "negative_hold" | "out_of_scope";

type Row = {
  pid: number;
  title: string;
  price: number;
  query: string;
  url: string;
  listingType: string;
  platform: string | null;
  model: string | null;
  edition: string | null;
  bodyConfig: string;
  comparableKey: string | null;
  needsReview: boolean;
  parseConfidence: number;
  decision: Decision;
  riskFlags: string[];
  reasons: string[];
};

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

function decide(row: Omit<Row, "decision" | "riskFlags">): { decision: Decision; riskFlags: string[] } {
  const modelNeedsReview = row.model ? REVIEW_MODELS.has(row.model) : false;
  const riskFlags = [
    modelNeedsReview ? "review_model_or_edition" : null,
    row.needsReview ? "parser_needs_review" : null,
    row.bodyConfig === "unknown_body" ? "unknown_body_config" : null,
    row.listingType !== "normal" ? `listing_type_${row.listingType}` : null,
  ].filter((value): value is string => Boolean(value));

  if (!row.platform || !row.model) return { decision: "out_of_scope", riskFlags };
  if (row.listingType === "normal" && row.comparableKey && !row.needsReview && !modelNeedsReview) {
    return { decision: "candidate_positive", riskFlags };
  }
  if (row.listingType === "normal" || row.needsReview || modelNeedsReview) {
    return { decision: "manual_review", riskFlags };
  }
  return { decision: "negative_hold", riskFlags };
}

async function main() {
  await mkdir(reportsDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const items = [...(await collectSearchItems(QUERIES, 2, 120)).values()];
  const rows: Row[] = items.map((item) => {
    const parsed = parseGameConsoleListing(item.name, "", item.price);
    const base = {
      pid: Number(item.pid),
      title: item.name,
      price: item.price,
      query: item.query,
      url: item.url,
      listingType: parsed.listingType,
      platform: parsed.platform,
      model: parsed.model,
      edition: parsed.edition,
      bodyConfig: parsed.bodyConfig,
      comparableKey: parsed.comparableKey,
      needsReview: parsed.needsReview,
      parseConfidence: parsed.parseConfidence,
      reasons: parsed.reasons,
    };
    return { ...base, ...decide(base) };
  });

  const candidateRows = rows.filter((row) => row.decision === "candidate_positive");
  const manualRows = rows.filter((row) => row.decision === "manual_review");
  const holdRows = rows.filter((row) => row.decision === "negative_hold");
  const riskCandidateRows = candidateRows.filter((row) => row.riskFlags.length > 0);

  const report = {
    generatedAt,
    reportOnly: true,
    liveSearchNoWrite: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    category: "game_console_body_narrow",
    scope: "live Bunjang search read-only scope for game console body-narrow candidates",
    queries: QUERIES,
    metrics: {
      liveFetchedUnique: rows.length,
      candidatePositive: candidateRows.length,
      manualReview: manualRows.length,
      negativeHold: holdRows.length,
      outOfScope: rows.filter((row) => row.decision === "out_of_scope").length,
      candidateRiskRows: riskCandidateRows.length,
      uniqueCandidateKeys: Object.keys(countBy(candidateRows, (row) => row.comparableKey ?? "null")).length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    byDecision: countBy(rows, (row) => row.decision),
    byListingType: countBy(rows, (row) => row.listingType),
    byModel: countBy(rows, (row) => row.model ?? "unknown"),
    candidateByComparableKey: countBy(candidateRows, (row) => row.comparableKey ?? "null"),
    candidateRows,
    riskCandidateRows,
    manualRows: manualRows.slice(0, 80),
    holdRows: holdRows.slice(0, 80),
    decision: riskCandidateRows.length > 0
      ? "game_console_live_search_candidate_risk_review_required"
      : candidateRows.length >= 10
        ? "game_console_live_search_supports_no_mutation_detail_sampling"
        : "game_console_live_search_too_sparse_for_runtime_decision",
    nextStep: riskCandidateRows.length > 0
      ? "Review riskCandidateRows before any detail sampling; keep report-only."
      : candidateRows.length >= 10
        ? "Use candidate rows for no-write detail sampling; do not write DB or candidate pool."
        : "Broaden query/category sampling before any runtime/public wiring.",
  };

  const jsonPath = path.join(reportsDir, "game-console-live-search-scope-latest.json");
  const mdPath = path.join(reportsDir, "game-console-live-search-scope-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Game Console Live Search Scope",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- liveSearchNoWrite: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision}`,
    "",
    "## Metrics",
    "",
    `- liveFetchedUnique: ${report.metrics.liveFetchedUnique}`,
    `- candidatePositive: ${report.metrics.candidatePositive}`,
    `- manualReview: ${report.metrics.manualReview}`,
    `- negativeHold: ${report.metrics.negativeHold}`,
    `- outOfScope: ${report.metrics.outOfScope}`,
    `- candidateRiskRows: ${report.metrics.candidateRiskRows}`,
    `- uniqueCandidateKeys: ${report.metrics.uniqueCandidateKeys}`,
    "",
    "## Candidate Comparable Keys",
    "",
    mdTable(["comparableKey", "count"], Object.entries(report.candidateByComparableKey)),
    "",
    "## Candidate Sample",
    "",
    mdTable(
      ["pid", "title", "price", "query", "key", "confidence"],
      candidateRows.slice(0, 60).map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.query,
        row.comparableKey ?? "",
        row.parseConfidence,
      ]),
    ),
    "",
    "## Risk Candidate Rows",
    "",
    riskCandidateRows.length
      ? mdTable(
          ["pid", "title", "key", "risk"],
          riskCandidateRows.map((row) => [row.pid, compact(row.title), row.comparableKey ?? "", row.riskFlags.join(", ")]),
        )
      : "- none",
    "",
    "## Manual Review Sample",
    "",
    mdTable(
      ["pid", "title", "price", "query", "model", "body", "needsReview", "reasons"],
      manualRows.slice(0, 50).map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.query,
        row.model ?? "",
        row.bodyConfig,
        row.needsReview,
        row.reasons.slice(0, 3).join(", "),
      ]),
    ),
    "",
    "## Hold Sample",
    "",
    mdTable(
      ["pid", "title", "price", "query", "listingType", "reasons"],
      holdRows.slice(0, 40).map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.query,
        row.listingType,
        row.reasons.slice(0, 3).join(", "),
      ]),
    ),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(
    JSON.stringify(
      {
        conclusion: report.decision,
        liveFetchedUnique: rows.length,
        candidatePositive: candidateRows.length,
        manualReview: manualRows.length,
        negativeHold: holdRows.length,
        candidateRiskRows: riskCandidateRows.length,
        jsonPath,
        mdPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
