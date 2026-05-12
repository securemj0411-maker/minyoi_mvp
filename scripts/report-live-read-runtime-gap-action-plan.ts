import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type ReplayRow = {
  lane: string;
  pid: string;
  title: string;
  sourceDisposition: "fresh_live_candidate" | "manual_review" | "hold";
  sourceReason: string;
  runtimeListingType: string;
  runtimeSkuId: string | null;
  runtimeCategory: string | null;
  comparableKey: string | null;
  needsReview: boolean | null;
  runtimeReady: boolean;
  outcome: "contract_pass" | "runtime_gap" | "metadata_gate_only" | "manual_review_preserved" | "hold_preserved";
};

type ReplayReport = {
  generatedAt: string;
  rows: ReplayRow[];
  metrics: Record<string, number>;
};

type Action = {
  lane: string;
  priority: "P0" | "P1" | "P2";
  actionType: "catalog_candidate_review" | "noise_rule_review" | "hold_boundary_regression" | "runtime_test_conversion";
  rows: ReplayRow[];
  recommendation: string;
  ownerApprovalRequired: boolean;
  forbiddenUntilApproved: string[];
};

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, "reports");
const SOURCE_FILE = path.join(REPORTS_DIR, "live-read-runtime-replay-latest.json");

function nextStepsFor(actions: Action[]) {
  const required = actions.filter((action) => action.ownerApprovalRequired);
  const steps = [
    "Convert contract-pass and preserved-boundary rows into regression tests first if we want zero behavior change.",
  ];
  if (required.length === 0) {
    steps.push("No runtime catalog/parser gap remains; keep public promotion and candidate-pool wiring blocked until a separate owner decision.");
    return steps;
  }

  const lanes = [...new Set(required.map((action) => action.lane))].join(", ");
  steps.push(`Owner approval is still required only for remaining gap lanes: ${lanes}.`);
  steps.push("Patch remaining gaps narrowly by lane; do not weaken global noise rules or open public/candidate-pool gates from this report.");
  return steps;
}

function planForLane(lane: string, rows: ReplayRow[]): Action[] {
  const gaps = rows.filter((row) => row.outcome === "runtime_gap");
  const passes = rows.filter((row) => row.outcome === "contract_pass");
  const preserved = rows.filter((row) => row.outcome === "hold_preserved" || row.outcome === "manual_review_preserved" || row.outcome === "metadata_gate_only");
  const actions: Action[] = [];

  if (gaps.length > 0) {
    const catalogLike = gaps.filter((row) => row.runtimeListingType === "unknown" && row.runtimeSkuId === null);
    const noiseLike = gaps.filter((row) => row.runtimeListingType !== "unknown" || row.runtimeSkuId !== null);
    if (catalogLike.length > 0) {
      actions.push({
        lane,
        priority: "P0",
        actionType: "catalog_candidate_review",
        rows: catalogLike,
        recommendation: "Add only narrow, evidence-backed catalog/parser coverage for these exact model rows, then replay before any public or pool wiring.",
        ownerApprovalRequired: true,
        forbiddenUntilApproved: ["public promotion", "candidate pool wiring", "Supabase write", "broad alias expansion"],
      });
    }
    if (noiseLike.length > 0) {
      actions.push({
        lane,
        priority: "P0",
        actionType: "noise_rule_review",
        rows: noiseLike,
        recommendation: "Inspect why the live candidate is not runtime-ready; prefer a local exception or title/description boundary test over broad keyword weakening.",
        ownerApprovalRequired: true,
        forbiddenUntilApproved: ["global noise weakening", "public promotion", "candidate pool wiring"],
      });
    }
  }

  if (preserved.length > 0) {
    actions.push({
      lane,
      priority: gaps.length > 0 ? "P1" : "P0",
      actionType: "hold_boundary_regression",
      rows: preserved,
      recommendation: "Convert preserved hold/manual/metadata rows into negative regression tests after the positive gap plan is approved.",
      ownerApprovalRequired: false,
      forbiddenUntilApproved: ["runtime behavior change"],
    });
  }

  if (passes.length > 0) {
    actions.push({
      lane,
      priority: gaps.length > 0 ? "P2" : "P0",
      actionType: "runtime_test_conversion",
      rows: passes,
      recommendation: "These rows can be converted into passing runtime regression tests without catalog/runtime behavior changes.",
      ownerApprovalRequired: false,
      forbiddenUntilApproved: ["public promotion", "candidate pool wiring"],
    });
  }

  return actions;
}

function renderMarkdown(report: {
  generatedAt: string;
  sourceReport: string;
  metrics: Record<string, number>;
  actions: Action[];
  conclusion: string;
  nextSteps: string[];
}) {
  return [
    "# Live-read Runtime Gap Action Plan",
    "",
    "실매물 runtime replay에서 나온 gap을 바로 패치하지 않고 lane별 승인/비승인 작업으로 나눈 액션 플랜입니다.",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- sourceReport: ${report.sourceReport}`,
    `- actionCount: ${report.metrics.actionCount}`,
    `- ownerApprovalRequiredActions: ${report.metrics.ownerApprovalRequiredActions}`,
    `- safeTestConversionActions: ${report.metrics.safeTestConversionActions}`,
    `- conclusion: ${report.conclusion}`,
    "",
    "## Next Steps",
    ...report.nextSteps.map((step) => `- ${step}`),
    "",
    "## Actions",
    "| priority | lane | type | rows | approval | recommendation |",
    "| --- | --- | --- | ---: | --- | --- |",
    ...report.actions.map((action) => `| ${action.priority} | ${action.lane} | ${action.actionType} | ${action.rows.length} | ${action.ownerApprovalRequired ? "required" : "not_required"} | ${action.recommendation.replaceAll("|", "\\|")} |`),
    "",
    "## Rows",
    ...report.actions.flatMap((action) => [
      `### ${action.priority} ${action.lane} ${action.actionType}`,
      "| pid | outcome | runtime | sku | title |",
      "| --- | --- | --- | --- | --- |",
      ...action.rows.map((row) => `| ${row.pid} | ${row.outcome} | ${row.runtimeListingType}${row.needsReview ? " review" : ""} | ${row.runtimeSkuId ?? "-"} | ${row.title.replaceAll("|", "\\|")} |`),
      "",
    ]),
  ].join("\n");
}

function main() {
  const replay = JSON.parse(readFileSync(SOURCE_FILE, "utf8")) as ReplayReport;
  const byLane = replay.rows.reduce<Record<string, ReplayRow[]>>((acc, row) => {
    acc[row.lane] ??= [];
    acc[row.lane].push(row);
    return acc;
  }, {});
  const actions = Object.entries(byLane).flatMap(([lane, rows]) => planForLane(lane, rows));
  const metrics = {
    replayRows: replay.rows.length,
    runtimeGapRows: replay.metrics.runtimeGapRows,
    actionCount: actions.length,
    ownerApprovalRequiredActions: actions.filter((action) => action.ownerApprovalRequired).length,
    safeTestConversionActions: actions.filter((action) => !action.ownerApprovalRequired).length,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolRows: 0,
    runtimeApplyRows: 0,
    dbMutationRows: 0,
  };
  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    runtimeCatalogApply: false,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    supabaseRead: false,
    supabaseWrite: false,
    sourceReport: "reports/live-read-runtime-replay-latest.json",
    conclusion: metrics.ownerApprovalRequiredActions > 0
      ? "runtime_gap_actions_require_owner_approval_before_catalog_or_parser_patch"
      : "runtime_gap_actions_safe_for_test_conversion",
    metrics,
    actions,
    nextSteps: nextStepsFor(actions),
  };

  mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(path.join(REPORTS_DIR, "live-read-runtime-gap-action-plan-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(path.join(REPORTS_DIR, "live-read-runtime-gap-action-plan-latest.md"), renderMarkdown(report));
  console.log(`live-read runtime gap action plan: actions=${metrics.actionCount}, ownerApproval=${metrics.ownerApprovalRequiredActions}`);
}

main();
