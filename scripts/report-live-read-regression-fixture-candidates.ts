import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Disposition = "fresh_live_candidate" | "manual_review" | "hold";

type ObservedRow = {
  pid: string;
  title: string;
  price: number;
  saleStatus: string;
  disposition: Disposition;
  reason: string;
};

type ReviewLane = {
  lane: string;
  label: string;
  status: "review_candidate" | "refinement_required";
  freshRows: ObservedRow[];
  manualRows: ObservedRow[];
  holdRows: ObservedRow[];
};

type OwnerPacket = {
  generatedAt: string;
  reviewCandidates: ReviewLane[];
};

type FixtureCandidate = {
  fixtureId: string;
  lane: string;
  pid: string;
  title: string;
  saleStatus: string;
  sourceDisposition: Disposition;
  expectedRuntimeDisposition: "normal_candidate" | "manual_review" | "hold";
  expectedReason: string;
  testValue: string;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePool: false;
  runtimeApply: false;
  dbMutation: false;
};

type Report = {
  generatedAt: string;
  reportOnly: true;
  runtimeCatalogApply: false;
  runtimeApply: false;
  publicPromotion: false;
  candidatePoolPolicyWiring: false;
  productionDbMutation: false;
  supabaseRead: false;
  supabaseWrite: false;
  sourceReport: string;
  conclusion: string;
  metrics: {
    lanes: number;
    fixtureCandidates: number;
    positiveFixtures: number;
    manualFixtures: number;
    holdFixtures: number;
    runtimeApprovedRows: 0;
    publicPromotionRows: 0;
    candidatePoolRows: 0;
    runtimeApplyRows: 0;
    dbMutationRows: 0;
  };
  fixtures: FixtureCandidate[];
  blockedUntil: string[];
  nextSteps: string[];
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const sourceRelativePath = "reports/category-live-read-owner-review-packet-latest.json";
const outputJsonPath = path.join(reportsDir, "live-read-regression-fixture-candidates-latest.json");
const outputMdPath = path.join(reportsDir, "live-read-regression-fixture-candidates-latest.md");

function expected(row: ObservedRow): Pick<FixtureCandidate, "expectedRuntimeDisposition" | "expectedReason"> {
  if (row.disposition === "fresh_live_candidate") {
    return {
      expectedRuntimeDisposition: "normal_candidate",
      expectedReason: row.reason,
    };
  }
  if (row.disposition === "manual_review") {
    return {
      expectedRuntimeDisposition: "manual_review",
      expectedReason: row.reason,
    };
  }
  return {
    expectedRuntimeDisposition: "hold",
    expectedReason: row.reason,
  };
}

function makeFixture(lane: ReviewLane, row: ObservedRow, index: number): FixtureCandidate {
  const e = expected(row);
  return {
    fixtureId: `${lane.lane}:${row.disposition}:${index + 1}:${row.pid}`,
    lane: lane.lane,
    pid: row.pid,
    title: row.title,
    saleStatus: row.saleStatus,
    sourceDisposition: row.disposition,
    ...e,
    testValue: `${row.title}\n판매상태:${row.saleStatus}\n관측사유:${row.reason}`,
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
    dbMutation: false,
  };
}

function renderMarkdown(report: Report) {
  return `${[
    "# Live-Read Regression Fixture Candidates",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- conclusion: ${report.conclusion}`,
    `- sourceReport: ${report.sourceReport}`,
    `- reportOnly: ${report.reportOnly}`,
    `- runtime/public/candidate/db mutation: ${report.runtimeApply}/${report.publicPromotion}/${report.candidatePoolPolicyWiring}/${report.productionDbMutation}`,
    "",
    "## Metrics",
    "",
    `- lanes: ${report.metrics.lanes}`,
    `- fixtureCandidates: ${report.metrics.fixtureCandidates}`,
    `- positiveFixtures: ${report.metrics.positiveFixtures}`,
    `- manualFixtures: ${report.metrics.manualFixtures}`,
    `- holdFixtures: ${report.metrics.holdFixtures}`,
    "",
    "## Fixtures",
    "",
    "| expected | lane | pid | saleStatus | reason | title |",
    "|---|---|---:|---|---|---|",
    ...report.fixtures.map((row) =>
      `| ${row.expectedRuntimeDisposition} | ${row.lane} | ${row.pid} | ${row.saleStatus || "-"} | ${row.expectedReason} | ${row.title.replaceAll("|", "/")} |`,
    ),
    "",
    "## Blocked Until",
    "",
    ...report.blockedUntil.map((item) => `- ${item}`),
    "",
    "## Next Steps",
    "",
    ...report.nextSteps.map((item) => `- ${item}`),
    "",
  ].join("\n")}\n`;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const source = JSON.parse(await readFile(path.join(appDir, sourceRelativePath), "utf8")) as OwnerPacket;
  const fixtures = source.reviewCandidates.flatMap((lane) => {
    const rows = [
      ...lane.freshRows.map((row) => ({ ...row, sourceDisposition: "fresh_live_candidate" as const })),
      ...lane.manualRows.map((row) => ({ ...row, sourceDisposition: "manual_review" as const })),
      ...lane.holdRows.map((row) => ({ ...row, sourceDisposition: "hold" as const })),
    ];
    return rows.map((row, index) => makeFixture(lane, row, index));
  });

  const report: Report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    runtimeCatalogApply: false,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    supabaseRead: false,
    supabaseWrite: false,
    sourceReport: sourceRelativePath,
    conclusion: "regression_fixture_candidates_ready_report_only_no_runtime_apply",
    metrics: {
      lanes: source.reviewCandidates.length,
      fixtureCandidates: fixtures.length,
      positiveFixtures: fixtures.filter((row) => row.expectedRuntimeDisposition === "normal_candidate").length,
      manualFixtures: fixtures.filter((row) => row.expectedRuntimeDisposition === "manual_review").length,
      holdFixtures: fixtures.filter((row) => row.expectedRuntimeDisposition === "hold").length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      runtimeApplyRows: 0,
      dbMutationRows: 0,
    },
    fixtures,
    blockedUntil: [
      "Owner explicitly approves converting these candidates into actual tests.",
      "Runtime patch scope is narrowed per lane and excludes public promotion/candidate pool wiring.",
      "A boundary audit remains pass after test generation.",
    ],
    nextSteps: [
      "If approved, convert this fixture candidate list into runtime parser tests only.",
      "Keep robot vacuum out of this fixture packet until query refinement yields clean fresh rows.",
      "Run no-write live-read after any future parser change before public promotion.",
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
