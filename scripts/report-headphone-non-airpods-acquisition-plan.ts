import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type SearchRow = {
  pid: number;
  title: string;
  query: string;
  runtimeSkuId: string | null;
  ruleMatchSkuId: string | null;
  comparableKey: string | null;
  decision: "candidate_positive" | "manual_review" | "negative_hold" | "out_of_scope";
};

type SearchScope = {
  generatedAt: string;
  metrics: {
    liveFetchedUnique: number;
    candidatePositive: number;
    manualReview: number;
    negativeHold: number;
    outOfScope: number;
    uniqueCandidateSkus: number;
  };
  rows: SearchRow[];
  candidateRows: SearchRow[];
};

type DetailRow = {
  pid: number;
  title: string;
  query: string;
  sourceDecision: "candidate_positive" | "manual_review" | "negative_hold" | "out_of_scope";
  sourceSku: string | null;
  comparableKey: string | null;
  detailSaleStatus: string | null;
  sold: boolean;
  listingTypeWithDetail: string;
  classificationChanged: boolean;
};

type DetailSample = {
  generatedAt: string;
  metrics: {
    sampled: number;
    candidateSampled: number;
    candidateProblemRows: number;
    soldRows: number;
    classificationChangedRows: number;
    detailMissingRows: number;
  };
  resultRows: DetailRow[];
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, file), "utf8")) as T;
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function compact(text: unknown, limit = 74) {
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

function skuOf(row: SearchRow) {
  return row.runtimeSkuId ?? row.ruleMatchSkuId ?? "unknown";
}

function detectAliasGapReason(title: string) {
  const normalized = title.toLowerCase().replace(/\s+/g, " ").trim();
  if (/qc\s*울트라|q c\s*울트라/.test(normalized)) return "bose_qc_ultra_korean_spacing_alias";
  if (/콰이어트\s*컴포트\s*45/.test(normalized)) return "bose_qc45_korean_fullname_alias";
  if (/wh-ch\s*720n|ch-?720n/.test(normalized)) return "sony_ch720n_spacing_alias";
  if (/wh-ch\s*520|ch-?520/.test(normalized)) return "sony_ch520_spacing_alias";
  if (/비츠\s*솔로\s*4|비츠솔로\s*4/.test(normalized)) return "beats_solo4_korean_spacing_alias";
  if (/wh\s*1000xm6/.test(normalized)) return "sony_xm6_spacing_alias";
  return "other_out_of_scope";
}

function laneDecision(sampled: number, activeClean: number, activeChanged: number, sold: number, searchVolume: number) {
  if (sampled === 0) return "hold_until_detail_sample";
  const activeProblemRate = activeChanged / Math.max(1, sampled - sold);
  if (activeClean >= 4 && activeProblemRate <= 0.2 && searchVolume >= 10) return "acquire_no_write_candidate";
  if (activeClean >= 3 && activeProblemRate <= 0.35) return "acquire_after_guardrail_review";
  return "hold_for_alias_or_classifier_review";
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const search = await readJson<SearchScope>("reports/headphone-non-airpods-live-search-scope-latest.json");
  const detail = await readJson<DetailSample>("reports/headphone-non-airpods-live-detail-sample-latest.json");

  const searchBySku = countBy(search.candidateRows, skuOf);
  const detailCandidateRows = detail.resultRows.filter((row) => row.sourceDecision === "candidate_positive");
  const laneRows = Object.entries(searchBySku).map(([sku, searchVolume]) => {
    const sampledRows = detailCandidateRows.filter((row) => row.sourceSku === sku);
    const soldRows = sampledRows.filter((row) => row.sold);
    const activeRows = sampledRows.filter((row) => !row.sold);
    const activeChangedRows = activeRows.filter((row) => row.classificationChanged);
    const activeCleanRows = activeRows.filter((row) => !row.classificationChanged);
    return {
      sku,
      searchVolume,
      sampled: sampledRows.length,
      activeClean: activeCleanRows.length,
      sold: soldRows.length,
      activeChanged: activeChangedRows.length,
      changedTypes: countBy(activeChangedRows, (row) => row.listingTypeWithDetail),
      decision: laneDecision(sampledRows.length, activeCleanRows.length, activeChangedRows.length, soldRows.length, Number(searchVolume)),
      problemSamples: [...soldRows, ...activeChangedRows].slice(0, 4),
    };
  });

  const outOfScopeRows = search.rows.filter((row) => row.decision === "out_of_scope");
  const aliasGapRows = outOfScopeRows.map((row) => ({ ...row, aliasGapReason: detectAliasGapReason(row.title) }));
  const aliasGapByReason = countBy(aliasGapRows, (row) => row.aliasGapReason);
  const acquisitionCandidates = laneRows.filter((row) => row.decision === "acquire_no_write_candidate");
  const guardedCandidates = laneRows.filter((row) => row.decision === "acquire_after_guardrail_review");
  const heldLanes = laneRows.filter((row) => row.decision === "hold_for_alias_or_classifier_review" || row.decision === "hold_until_detail_sample");
  const report = {
    generatedAt,
    reportOnly: true,
    liveSearchNoWrite: true,
    productionDbMutation: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    category: "headphone_discovered",
    sourceReports: [
      "reports/headphone-non-airpods-live-search-scope-latest.json",
      "reports/headphone-non-airpods-live-detail-sample-latest.json",
    ],
    metrics: {
      liveFetchedUnique: search.metrics.liveFetchedUnique,
      candidatePositive: search.metrics.candidatePositive,
      sampled: detail.metrics.sampled,
      activeClassificationChangedRows: detailCandidateRows.filter((row) => !row.sold && row.classificationChanged).length,
      soldRows: detail.metrics.soldRows,
      acquireNoWriteLanes: acquisitionCandidates.length,
      guardedLanes: guardedCandidates.length,
      heldLanes: heldLanes.length,
      aliasGapRows: aliasGapRows.filter((row) => row.aliasGapReason !== "other_out_of_scope").length,
    },
    laneRows,
    aliasGapByReason,
    aliasGapRows: aliasGapRows.filter((row) => row.aliasGapReason !== "other_out_of_scope"),
    decision:
      acquisitionCandidates.length >= 6 && heldLanes.length <= 2
        ? "non_airpods_headphone_acquisition_can_start_with_lane_guards"
        : "non_airpods_headphone_needs_more_alias_or_guardrail_review_before_acquisition",
    nextStep:
      "Start with no-write acquisition for acquire_no_write_candidate lanes only; keep guarded lanes report-only until alias/negative guard review clears active classification changes.",
  };

  await writeFile(path.join(reportsDir, "headphone-non-airpods-acquisition-plan-latest.json"), `${JSON.stringify(report, null, 2)}\n`);

  const laneTable = laneRows.map((row) => [
    row.sku,
    row.searchVolume,
    row.sampled,
    row.activeClean,
    row.sold,
    row.activeChanged,
    Object.entries(row.changedTypes)
      .map(([type, count]) => `${type}:${count}`)
      .join(", ") || "-",
    row.decision,
  ]);
  const md = [
    "# Headphone Non-AirPods Acquisition Plan",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- liveSearchNoWrite: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision}`,
    "",
    "## Summary",
    "",
    `- liveFetchedUnique: ${report.metrics.liveFetchedUnique}`,
    `- candidatePositive: ${report.metrics.candidatePositive}`,
    `- sampled: ${report.metrics.sampled}`,
    `- activeClassificationChangedRows: ${report.metrics.activeClassificationChangedRows}`,
    `- soldRows: ${report.metrics.soldRows}`,
    `- acquireNoWriteLanes: ${report.metrics.acquireNoWriteLanes}`,
    `- guardedLanes: ${report.metrics.guardedLanes}`,
    `- heldLanes: ${report.metrics.heldLanes}`,
    `- aliasGapRows: ${report.metrics.aliasGapRows}`,
    "",
    "## Lane Decisions",
    "",
    mdTable(
      ["sku", "search", "sampled", "activeClean", "sold", "activeChanged", "changedTypes", "decision"],
      laneTable,
    ),
    "",
    "## Alias Gap Reasons",
    "",
    mdTable(["reason", "count"], Object.entries(aliasGapByReason)),
    "",
    "## Alias Gap Samples",
    "",
    report.aliasGapRows.length
      ? mdTable(
          ["pid", "title", "query", "reason"],
          report.aliasGapRows.slice(0, 30).map((row) => [row.pid, compact(row.title), row.query, row.aliasGapReason]),
        )
      : "- none",
    "",
    "## Problem Samples by Lane",
    "",
    laneRows
      .filter((row) => row.problemSamples.length > 0)
      .map((row) => [
        `### ${row.sku}`,
        "",
        mdTable(
          ["pid", "title", "sold", "detailType", "status"],
          row.problemSamples.map((sample) => [
            sample.pid,
            compact(sample.title),
            sample.sold,
            sample.listingTypeWithDetail,
            sample.detailSaleStatus ?? "",
          ]),
        ),
      ].join("\n"))
      .join("\n\n") || "- none",
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "headphone-non-airpods-acquisition-plan-latest.md"), `${md}\n`);
  console.log(
    `headphone non-AirPods acquisition plan: acquire=${report.metrics.acquireNoWriteLanes}, guarded=${report.metrics.guardedLanes}, held=${report.metrics.heldLanes}, aliasGaps=${report.metrics.aliasGapRows}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
