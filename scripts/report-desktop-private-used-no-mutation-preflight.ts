import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type BoundaryFixture = {
  runtimeApproved?: boolean;
  publicPromotion?: boolean;
  candidatePoolReady?: boolean;
};

type BackfillFixture = BoundaryFixture & {
  caseId: string;
  pid: string;
  title: string;
  decision: "positive_contract_candidate" | "manual_owner_decision" | "hold_negative_fixture";
  bucket: string;
  cpuIdentity: string | null;
  gpuIdentity: string | null;
  evidenceRule: string;
  reason: string;
};

type TargetedFixture = BoundaryFixture & {
  caseId: string;
  pid: string;
  title: string;
  decision: "strict_positive" | "manual_owner_decision" | "hold_negative_fixture";
  bucket: string;
  cpuIdentity: string | null;
  gpuIdentity: string | null;
  evidenceRule: string;
  reason: string;
  shopProshop?: boolean;
};

type ContractFixture = {
  caseId: string;
  pid: string;
  expectedDecision: "positive_contract_candidate" | "hold";
  expectedBucket: string;
  cpuIdentity: string | null;
  gpuIdentity: string | null;
  title: string;
};

type EvidenceReport<TFixture> = {
  generatedAt?: string;
  conclusion?: string;
  reportOnly?: boolean;
  publicPromotion?: boolean;
  runtimeCatalogApply?: boolean;
  candidatePoolPolicyWiring?: boolean;
  runtimeApprovedRows?: number;
  publicPromotionRows?: number;
  candidatePoolRows?: number;
  productionDbMutation?: boolean;
  directThirtyDayPlanEdit?: boolean;
  metrics?: Record<string, unknown>;
  fixtures?: TFixture[];
  sourceReportsRead?: string[];
};

type RiskStatus = "excluded_by_patch_scope" | "blocked_until_owner_decision" | "covered_negative_hold";

type RiskEvaluation = {
  id: string;
  status: RiskStatus;
  runtimePatchImpact: "allow_narrow_patch" | "block_if_included";
  evidenceRows: string[];
  decision: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

const inputFiles = [
  "reports/category-orchestration-status-latest.md",
  "reports/category-orchestration-status-latest.json",
  "reports/desktop-private-used-targeted-acquisition-latest.md",
  "reports/desktop-private-used-targeted-acquisition-latest.json",
  "reports/desktop-private-used-positive-backfill-latest.md",
  "reports/desktop-private-used-positive-backfill-latest.json",
  "reports/desktop-private-used-cpu-gpu-contract-latest.md",
  "reports/desktop-private-used-cpu-gpu-contract-latest.json",
  "reports/desktop-private-used-runtime-impact-review-2026-05-12.md",
];

const forbiddenFiles = [
  "src/lib/*",
  "supabase/schema.sql",
  "src/app/api/cron/*",
  "src/components/pack-shop.tsx",
  "src/components/pack-reveal-modal.tsx",
  "src/lib/candidate-pool-builder.ts",
  "category-intelligence/**/*",
  "30일_실행계획.md",
];

function mdEscape(value: unknown): string {
  return String(value ?? "-").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function table(headers: string[], rows: unknown[][]): string {
  return [
    `| ${headers.map(mdEscape).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`),
  ].join("\n");
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, relativePath), "utf8")) as T;
}

async function readText(relativePath: string): Promise<string> {
  return readFile(path.join(appDir, relativePath), "utf8");
}

function metricNumber(metrics: Record<string, unknown> | undefined, key: string): number {
  const value = metrics?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function allBoundaryFixturesFalse(fixtures: BoundaryFixture[]): boolean {
  return fixtures.every(
    (fixture) =>
      fixture.runtimeApproved === false &&
      fixture.publicPromotion === false &&
      fixture.candidatePoolReady === false,
  );
}

function uniqueRows<T extends { pid: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.pid)) return false;
    seen.add(row.pid);
    return true;
  });
}

function toPositiveRows(backfill: BackfillFixture[], targeted: TargetedFixture[]) {
  return uniqueRows([
    ...backfill
      .filter((row) => row.decision === "positive_contract_candidate")
      .map((row) => ({
        caseId: row.caseId,
        pid: row.pid,
        source: "positive_backfill",
        cpuIdentity: row.cpuIdentity,
        gpuIdentity: row.gpuIdentity,
        evidenceRule: row.evidenceRule,
        title: row.title,
      })),
    ...targeted
      .filter((row) => row.decision === "strict_positive")
      .map((row) => ({
        caseId: row.caseId,
        pid: row.pid,
        source: "targeted_acquisition",
        cpuIdentity: row.cpuIdentity,
        gpuIdentity: row.gpuIdentity,
        evidenceRule: row.evidenceRule,
        title: row.title,
      })),
  ]);
}

function buildRiskEvaluations(backfill: BackfillFixture[], targeted: TargetedFixture[]): RiskEvaluation[] {
  const allRows = [...backfill, ...targeted];
  const byBucket = (needles: string[]) =>
    allRows
      .filter((row) => needles.some((needle) => row.bucket.includes(needle)))
      .map((row) => `${row.caseId}:${row.pid}`);

  return [
    {
      id: "description_backed_cpu",
      status: "blocked_until_owner_decision",
      runtimePatchImpact: "block_if_included",
      evidenceRows: byBucket(["description_backed_cpu"]),
      decision:
        "Description-only CPU identity remains outside positives; a future narrow patch may only accept title-visible CPU identity.",
    },
    {
      id: "bare_gpu_tokens",
      status: "blocked_until_owner_decision",
      runtimePatchImpact: "block_if_included",
      evidenceRows: byBucket(["bare_5080", "bare_9070xt"]),
      decision:
        "Bare 5080/9070xt-style GPU tokens remain manual/hold unless RTX/RX-prefix policy is approved.",
    },
    {
      id: "peripheral_monitor_bundles",
      status: "blocked_until_owner_decision",
      runtimePatchImpact: "block_if_included",
      evidenceRows: byBucket(["peripheral_bundle", "monitor_bundle", "monitor_add_on"]),
      decision:
        "Monitor/peripheral bundle and body-price plus add-on rows stay out of strict single-body positives.",
    },
    {
      id: "private_used_vs_shop_templates",
      status: "covered_negative_hold",
      runtimePatchImpact: "allow_narrow_patch",
      evidenceRows: allRows
        .filter((row) => /proshop|shop|template|configurable|custom|unused_build|new_parts/.test(row.bucket))
        .map((row) => `${row.caseId}:${row.pid}`),
      decision:
        "Proshop, new-build, configurable, custom quote, shop template, receipt/A-S, and upgrade-option rows are negative/hold fixtures.",
    },
    {
      id: "insufficient_private_used_wording",
      status: "excluded_by_patch_scope",
      runtimePatchImpact: "block_if_included",
      evidenceRows: byBucket(["missing_private_used_language"]),
      decision:
        "Rows with CPU/GPU tokens but insufficient personal/private-used wording remain excluded from positives.",
    },
  ];
}

function buildChecks(input: {
  backfill: EvidenceReport<BackfillFixture>;
  targeted: EvidenceReport<TargetedFixture>;
  contract: EvidenceReport<ContractFixture>;
  categoryStatusMd: string;
  categoryStatusJson: Record<string, unknown>;
  runtimeImpactMd: string;
  positiveRows: ReturnType<typeof toPositiveRows>;
  riskEvaluations: RiskEvaluation[];
}) {
  const backfillFixtures = input.backfill.fixtures ?? [];
  const targetedFixtures = input.targeted.fixtures ?? [];
  const contractFixtures = input.contract.fixtures ?? [];
  const manualRows = [...backfillFixtures, ...targetedFixtures].filter(
    (row) => row.decision === "manual_owner_decision",
  );
  const holdRows = [...backfillFixtures, ...targetedFixtures].filter(
    (row) => row.decision === "hold_negative_fixture",
  );
  const sourceBoundaries = [input.backfill, input.targeted, input.contract];

  return [
    {
      id: "PREFLIGHT-01",
      status: input.positiveRows.length === 10 ? "pass" : "fail",
      check: "10 cumulative strict positives are available",
      detail: `positiveRows=${input.positiveRows.length}`,
    },
    {
      id: "PREFLIGHT-02",
      status: metricNumber(input.targeted.metrics, "combinedStrictPositiveRows") === 10 ? "pass" : "fail",
      check: "targeted acquisition reports combinedStrictPositiveRows=10",
      detail: `combinedStrictPositiveRows=${metricNumber(input.targeted.metrics, "combinedStrictPositiveRows")}`,
    },
    {
      id: "PREFLIGHT-03",
      status: manualRows.some((row) => row.bucket.includes("monitor_add_on")) &&
        manualRows.some((row) => row.bucket.includes("peripheral_bundle")) &&
        manualRows.some((row) => row.bucket.includes("missing_private_used_language"))
        ? "pass"
        : "fail",
      check: "manual bundle/body-add-on/insufficient-private-used rows are not positives",
      detail: `manualRows=${manualRows.length}`,
    },
    {
      id: "PREFLIGHT-04",
      status: holdRows.some((row) => /proshop|shop|template|configurable|new_parts|unused_build/.test(row.bucket))
        ? "pass"
        : "fail",
      check: "proshop/new-build/configurable/shop template rows remain negative/hold",
      detail: `holdRows=${holdRows.length}`,
    },
    {
      id: "PREFLIGHT-05",
      status: input.riskEvaluations.every((risk) => risk.evidenceRows.length > 0) ? "pass" : "fail",
      check: "unresolved policy risks have explicit evidence rows and decisions",
      detail: input.riskEvaluations.map((risk) => `${risk.id}:${risk.evidenceRows.length}`).join(", "),
    },
    {
      id: "PREFLIGHT-06",
      status: sourceBoundaries.every(
        (report) =>
          report.reportOnly === true &&
          report.publicPromotion === false &&
          report.runtimeCatalogApply === false &&
          report.candidatePoolPolicyWiring === false &&
          report.productionDbMutation === false &&
          report.directThirtyDayPlanEdit === false,
      )
        ? "pass"
        : "fail",
      check: "source reports preserve report-only no-mutation boundaries",
      detail: "reportOnly=true and runtime/public/candidate/DB/plan mutation flags false",
    },
    {
      id: "PREFLIGHT-07",
      status: allBoundaryFixturesFalse([...backfillFixtures, ...targetedFixtures]) ? "pass" : "fail",
      check: "all input fixtures have runtimeApproved/publicPromotion/candidatePoolReady=false",
      detail: `fixtureRows=${backfillFixtures.length + targetedFixtures.length}`,
    },
    {
      id: "PREFLIGHT-08",
      status: contractFixtures.filter((row) => row.expectedDecision === "hold").length >= 10 ? "pass" : "fail",
      check: "contract keeps at least 10 hold rows for boundary pressure",
      detail: `contractHoldRows=${contractFixtures.filter((row) => row.expectedDecision === "hold").length}`,
    },
    {
      id: "PREFLIGHT-09",
      status: input.categoryStatusMd.includes("targeted_acquisition_goal_met_no_mutation_preflight_next") &&
        input.categoryStatusMd.includes("desktop_private_used_cpu_gpu")
        ? "pass"
        : "fail",
      check: "category orchestration points this lane to no-mutation preflight next",
      detail: `categoryStatusJsonKeys=${Object.keys(input.categoryStatusJson).length}`,
    },
    {
      id: "PREFLIGHT-10",
      status: input.runtimeImpactMd.includes("Do not runtime-wire this lane yet") &&
        input.runtimeImpactMd.includes("At least 10-15 positive private-used rows")
        ? "pass"
        : "fail",
      check: "runtime impact review is acknowledged and superseded only by report-only preflight",
      detail: "runtimeApply remains false; no runtime patch applied",
    },
  ];
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const [categoryStatusMd, categoryStatusJson, targeted, backfill, contract, runtimeImpactMd] = await Promise.all([
    readText("reports/category-orchestration-status-latest.md"),
    readJson<Record<string, unknown>>("reports/category-orchestration-status-latest.json"),
    readJson<EvidenceReport<TargetedFixture>>("reports/desktop-private-used-targeted-acquisition-latest.json"),
    readJson<EvidenceReport<BackfillFixture>>("reports/desktop-private-used-positive-backfill-latest.json"),
    readJson<EvidenceReport<ContractFixture>>("reports/desktop-private-used-cpu-gpu-contract-latest.json"),
    readText("reports/desktop-private-used-runtime-impact-review-2026-05-12.md"),
  ]);

  const backfillFixtures = backfill.fixtures ?? [];
  const targetedFixtures = targeted.fixtures ?? [];
  const positiveRows = toPositiveRows(backfillFixtures, targetedFixtures);
  const riskEvaluations = buildRiskEvaluations(backfillFixtures, targetedFixtures);
  const preflightChecks = buildChecks({
    backfill,
    targeted,
    contract,
    categoryStatusMd,
    categoryStatusJson,
    runtimeImpactMd,
    positiveRows,
    riskEvaluations,
  });
  const failedChecks = preflightChecks.filter((check) => check.status !== "pass");
  const manualRows = [...backfillFixtures, ...targetedFixtures].filter(
    (row) => row.decision === "manual_owner_decision",
  );
  const holdRows = [...backfillFixtures, ...targetedFixtures].filter(
    (row) => row.decision === "hold_negative_fixture",
  );
  const runtimePatchScope = {
    lane: "desktop_private_used_cpu_gpu",
    futurePatchScope:
      "narrow internal-only parser foundation for title-visible CPU plus title-visible RTX/RX GPU, fixed one-off private-used desktop body rows only",
    readyForFutureNarrowRuntimePatch: failedChecks.length === 0,
    readyForRuntimeApplyNow: false,
    runtimeApply: false,
    runtimeApplyRows: 0,
    runtimeApproved: false,
    runtimeApprovedRows: 0,
    publicPromotion: false,
    publicPromotionRows: 0,
    candidatePool: false,
    candidatePoolRows: 0,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
  };

  const report = {
    generatedAt,
    lane: runtimePatchScope.lane,
    conclusion: failedChecks.length === 0
      ? "desktop_private_used_no_mutation_preflight_passed_for_future_narrow_patch_review_only"
      : "desktop_private_used_no_mutation_preflight_blocked",
    reportOnly: true,
    runtimePatchScope,
    boundary: {
      reportOnly: true,
      runtimeApproved: false,
      runtimeApprovedRows: 0,
      runtimeApply: false,
      runtimeApplyRows: 0,
      publicPromotion: false,
      publicPromotionRows: 0,
      candidatePool: false,
      candidatePoolRows: 0,
      candidatePoolPolicyWiring: false,
      productionDbMutation: false,
      directThirtyDayPlanEdit: false,
    },
    metrics: {
      positiveFixtureRows: positiveRows.length,
      inheritedBackfillPositiveRows: backfillFixtures.filter((row) => row.decision === "positive_contract_candidate").length,
      targetedPositiveRows: targetedFixtures.filter((row) => row.decision === "strict_positive").length,
      manualRows: manualRows.length,
      holdRowCount: holdRows.length,
      contractFixtureRows: contract.fixtures?.length ?? 0,
      contractHoldRows: contract.fixtures?.filter((row) => row.expectedDecision === "hold").length ?? 0,
      preflightChecks: preflightChecks.length,
      failedChecks: failedChecks.length,
      unresolvedPolicyRisks: riskEvaluations.length,
      runtimeApprovedRows: 0,
      runtimeApplyRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
    },
    positiveFixtures: positiveRows,
    manualExcludedRows: manualRows.map((row) => ({
      caseId: row.caseId,
      pid: row.pid,
      bucket: row.bucket,
      reason: row.reason,
      title: row.title,
    })),
    negativeHoldRows: holdRows.map((row) => ({
      caseId: row.caseId,
      pid: row.pid,
      bucket: row.bucket,
      reason: row.reason,
      title: row.title,
    })),
    riskEvaluations,
    preflightChecks,
    failedChecks,
    inputFiles,
    forbiddenFiles,
    nextAction:
      "Owner/main-agent may review a future narrow internal-only runtime patch proposal; this package does not apply runtime, DB, public promotion, or candidate-pool changes.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "desktop-private-used-no-mutation-preflight-latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  const md = [
    "# Desktop Private-Used No-Mutation Preflight",
    "",
    `- generatedAt: ${generatedAt}`,
    `- lane: ${report.lane}`,
    `- conclusion: ${report.conclusion}`,
    `- readyForFutureNarrowRuntimePatch: ${runtimePatchScope.readyForFutureNarrowRuntimePatch}`,
    "- readyForRuntimeApplyNow: false",
    "",
    "## Boundary",
    "",
    "- reportOnly: true",
    "- runtimeApproved/runtimeApply/publicPromotion/candidatePool: false/false/false/false",
    "- runtimeApprovedRows/runtimeApplyRows/publicPromotionRows/candidatePoolRows: 0/0/0/0",
    "- productionDbMutation: false",
    "- directThirtyDayPlanEdit: false",
    "",
    "## Metrics",
    "",
    table(
      ["metric", "value"],
      [
        ["positiveFixtureRows", report.metrics.positiveFixtureRows],
        ["inheritedBackfillPositiveRows", report.metrics.inheritedBackfillPositiveRows],
        ["targetedPositiveRows", report.metrics.targetedPositiveRows],
        ["manualRows", report.metrics.manualRows],
        ["holdRows", report.metrics.holdRowCount],
        ["contractFixtureRows", report.metrics.contractFixtureRows],
        ["contractHoldRows", report.metrics.contractHoldRows],
        ["preflightChecks", report.metrics.preflightChecks],
        ["failedChecks", report.metrics.failedChecks],
        ["unresolvedPolicyRisks", report.metrics.unresolvedPolicyRisks],
      ],
    ),
    "",
    "## Preflight Checks",
    "",
    table(
      ["id", "status", "check", "detail"],
      preflightChecks.map((row) => [row.id, row.status, row.check, row.detail]),
    ),
    "",
    "## Positive Fixtures",
    "",
    table(
      ["caseId", "pid", "source", "cpu", "gpu", "rule", "title"],
      positiveRows.map((row) => [
        row.caseId,
        row.pid,
        row.source,
        row.cpuIdentity,
        row.gpuIdentity,
        row.evidenceRule,
        row.title,
      ]),
    ),
    "",
    "## Manual Rows Excluded From Positives",
    "",
    table(
      ["caseId", "pid", "bucket", "reason", "title"],
      report.manualExcludedRows.map((row) => [row.caseId, row.pid, row.bucket, row.reason, row.title]),
    ),
    "",
    "## Negative / Hold Rows",
    "",
    table(
      ["caseId", "pid", "bucket", "reason", "title"],
      report.negativeHoldRows.map((row) => [row.caseId, row.pid, row.bucket, row.reason, row.title]),
    ),
    "",
    "## Policy Risk Evaluation",
    "",
    table(
      ["risk", "status", "patchImpact", "evidenceRows", "decision"],
      riskEvaluations.map((risk) => [
        risk.id,
        risk.status,
        risk.runtimePatchImpact,
        risk.evidenceRows.join(", "),
        risk.decision,
      ]),
    ),
    "",
    "## Future Patch Scope",
    "",
    runtimePatchScope.futurePatchScope,
    "",
    "## Forbidden Surfaces",
    "",
    ...forbiddenFiles.map((file) => `- ${file}`),
    "",
    "## Inputs Read",
    "",
    ...inputFiles.map((file) => `- ${file}`),
    "",
    "## Next Action",
    "",
    report.nextAction,
    "",
  ].join("\n");

  await writeFile(path.join(reportsDir, "desktop-private-used-no-mutation-preflight-latest.md"), md);

  console.log(JSON.stringify({
    report: "reports/desktop-private-used-no-mutation-preflight-latest",
    conclusion: report.conclusion,
    readyForFutureNarrowRuntimePatch: runtimePatchScope.readyForFutureNarrowRuntimePatch,
    readyForRuntimeApplyNow: false,
    positiveFixtureRows: report.metrics.positiveFixtureRows,
    manualRows: report.metrics.manualRows,
    holdRows: report.metrics.holdRowCount,
    failedChecks: report.metrics.failedChecks,
    runtimeApprovedRows: 0,
    runtimeApplyRows: 0,
    publicPromotionRows: 0,
    candidatePoolRows: 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
