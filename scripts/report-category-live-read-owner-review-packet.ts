import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Disposition = "fresh_live_candidate" | "manual_review" | "hold";

type ObservedRow = {
  pid: string;
  title: string;
  price: number;
  url: string;
  query: string;
  saleStatus: string;
  disposition: Disposition;
  reason: string;
  matchedSignals: string[];
  holdSignals: string[];
};

type LaneResult = {
  lane: string;
  label: string;
  category: string;
  queries: string[];
  searchRowsRead: number;
  detailRowsRead: number;
  freshLiveCandidates: number;
  manualReviewRows: number;
  holdRows: number;
  rows: ObservedRow[];
};

type LiveReadReport = {
  generatedAt: string;
  reportOnly: true;
  metrics: Record<string, number>;
  lanes: LaneResult[];
};

type ReviewLane = {
  lane: string;
  label: string;
  status: "review_candidate" | "refinement_required";
  reason: string;
  freshRows: ObservedRow[];
  manualRows: ObservedRow[];
  holdRows: ObservedRow[];
  recommendedAction: string;
  runtimeScopeAllowed: false;
};

type Report = {
  generatedAt: string;
  reportOnly: true;
  runtimeCatalogApply: false;
  runtimeApply: false;
  publicPromotion: false;
  candidatePoolPolicyWiring: false;
  productionDbMutation: false;
  sourceHealthMutation: false;
  supabaseRead: false;
  supabaseWrite: false;
  ownership: "category_live_read_owner_review_packet";
  conclusion: string;
  sourceReport: string;
  metrics: {
    reviewCandidateLanes: number;
    refinementRequiredLanes: number;
    freshRowsInReviewLanes: number;
    manualRowsInReviewLanes: number;
    holdRowsInReviewLanes: number;
    runtimeApprovedRows: 0;
    publicPromotionRows: 0;
    candidatePoolRows: 0;
    runtimeApplyRows: 0;
    dbMutationRows: 0;
  };
  reviewCandidates: ReviewLane[];
  refinementRequired: ReviewLane[];
  ownerDecisionRequired: string[];
  nextSteps: string[];
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const sourceRelativePath = "reports/category-no-write-live-read-observation-latest.json";
const outputJsonPath = path.join(reportsDir, "category-live-read-owner-review-packet-latest.json");
const outputMdPath = path.join(reportsDir, "category-live-read-owner-review-packet-latest.md");

const reviewCandidateLanes = new Set([
  "camera_body_only_exact_model",
  "monitor_selected_exact_model",
  "speaker_selected_subset",
]);

function splitLane(lane: LaneResult): ReviewLane {
  const freshRows = lane.rows.filter((row) => row.disposition === "fresh_live_candidate");
  const manualRows = lane.rows.filter((row) => row.disposition === "manual_review");
  const holdRows = lane.rows.filter((row) => row.disposition === "hold");
  const isCandidate = reviewCandidateLanes.has(lane.lane) && freshRows.length > 0;
  return {
    lane: lane.lane,
    label: lane.label,
    status: isCandidate ? "review_candidate" : "refinement_required",
    reason: isCandidate
      ? "No-write live read found fresh candidates while preserving hold/manual boundaries."
      : "No fresh candidates or high noise in no-write live read; refine query/rules before runtime review.",
    freshRows,
    manualRows,
    holdRows,
    recommendedAction: isCandidate
      ? "Prepare owner-reviewed runtime regression fixtures from fresh/hold/manual rows. Do not apply runtime yet."
      : "Run a query refinement report and reduce accessory/fraud/consumable noise before runtime review.",
    runtimeScopeAllowed: false,
  };
}

function renderRows(rows: ObservedRow[]) {
  if (!rows.length) return ["_none_"];
  return [
    "| pid | price | saleStatus | reason | title |",
    "|---:|---:|---|---|---|",
    ...rows.map((row) =>
      `| ${row.pid} | ${row.price.toLocaleString("ko-KR")} | ${row.saleStatus || "-"} | ${row.reason} | ${row.title.replaceAll("|", "/")} |`,
    ),
  ];
}

function renderMarkdown(report: Report) {
  const lines = [
    "# Category Live-Read Owner Review Packet",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- conclusion: ${report.conclusion}`,
    `- sourceReport: ${report.sourceReport}`,
    `- reportOnly: ${report.reportOnly}`,
    `- runtime/public/candidate/db mutation: ${report.runtimeApply}/${report.publicPromotion}/${report.candidatePoolPolicyWiring}/${report.productionDbMutation}`,
    "",
    "## Metrics",
    "",
    `- reviewCandidateLanes: ${report.metrics.reviewCandidateLanes}`,
    `- refinementRequiredLanes: ${report.metrics.refinementRequiredLanes}`,
    `- freshRowsInReviewLanes: ${report.metrics.freshRowsInReviewLanes}`,
    `- manualRowsInReviewLanes: ${report.metrics.manualRowsInReviewLanes}`,
    `- holdRowsInReviewLanes: ${report.metrics.holdRowsInReviewLanes}`,
    "",
    "## Review Candidates",
    "",
  ];

  for (const lane of report.reviewCandidates) {
    lines.push(
      `### ${lane.label}`,
      "",
      `- lane: ${lane.lane}`,
      `- reason: ${lane.reason}`,
      `- recommendedAction: ${lane.recommendedAction}`,
      "",
      "Fresh rows:",
      "",
      ...renderRows(lane.freshRows),
      "",
      "Manual rows:",
      "",
      ...renderRows(lane.manualRows),
      "",
      "Hold rows:",
      "",
      ...renderRows(lane.holdRows),
      "",
    );
  }

  lines.push("## Refinement Required", "");
  for (const lane of report.refinementRequired) {
    lines.push(
      `### ${lane.label}`,
      "",
      `- lane: ${lane.lane}`,
      `- reason: ${lane.reason}`,
      `- recommendedAction: ${lane.recommendedAction}`,
      `- fresh/manual/hold: ${lane.freshRows.length}/${lane.manualRows.length}/${lane.holdRows.length}`,
      "",
      "Hold rows:",
      "",
      ...renderRows(lane.holdRows),
      "",
    );
  }

  lines.push(
    "## Owner Decision Required",
    "",
    ...report.ownerDecisionRequired.map((item) => `- ${item}`),
    "",
    "## Next Steps",
    "",
    ...report.nextSteps.map((item) => `- ${item}`),
    "",
  );
  return `${lines.join("\n")}\n`;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const source = JSON.parse(await readFile(path.join(appDir, sourceRelativePath), "utf8")) as LiveReadReport;
  const lanes = source.lanes.map(splitLane);
  const reviewCandidates = lanes.filter((lane) => lane.status === "review_candidate");
  const refinementRequired = lanes.filter((lane) => lane.status === "refinement_required");
  const freshRowsInReviewLanes = reviewCandidates.reduce((sum, lane) => sum + lane.freshRows.length, 0);
  const manualRowsInReviewLanes = reviewCandidates.reduce((sum, lane) => sum + lane.manualRows.length, 0);
  const holdRowsInReviewLanes = reviewCandidates.reduce((sum, lane) => sum + lane.holdRows.length, 0);

  const report: Report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    runtimeCatalogApply: false,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    sourceHealthMutation: false,
    supabaseRead: false,
    supabaseWrite: false,
    ownership: "category_live_read_owner_review_packet",
    conclusion: "camera_monitor_speaker_ready_for_owner_runtime_review_packet_robot_vacuum_requires_refinement",
    sourceReport: sourceRelativePath,
    metrics: {
      reviewCandidateLanes: reviewCandidates.length,
      refinementRequiredLanes: refinementRequired.length,
      freshRowsInReviewLanes,
      manualRowsInReviewLanes,
      holdRowsInReviewLanes,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      runtimeApplyRows: 0,
      dbMutationRows: 0,
    },
    reviewCandidates,
    refinementRequired,
    ownerDecisionRequired: [
      "Approve only a future runtime regression-test design for camera/monitor/speaker, not public promotion.",
      "Keep robot vacuum out of runtime review until query refinement produces at least one clean fresh row without fraud/accessory/consumable noise.",
      "Do not wire candidate pool or runtime catalog from this packet alone.",
    ],
    nextSteps: [
      "Generate runtime regression fixture candidates for camera/monitor/speaker from this packet.",
      "Generate a robot-vacuum query refinement report with narrower full-unit terms.",
      "Run boundary audit after every packet generation.",
    ],
  };

  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(outputMdPath, renderMarkdown(report), "utf8");
  console.log(`wrote ${path.relative(appDir, outputJsonPath)}`);
  console.log(`wrote ${path.relative(appDir, outputMdPath)}`);
  console.log(JSON.stringify(report.metrics));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
