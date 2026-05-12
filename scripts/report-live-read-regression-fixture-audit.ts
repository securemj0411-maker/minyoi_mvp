import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ExpectedDisposition = "normal_candidate" | "manual_review" | "hold";

type Fixture = {
  fixtureId: string;
  lane: string;
  pid: string;
  title: string;
  saleStatus: string;
  expectedRuntimeDisposition: ExpectedDisposition;
  expectedReason: string;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePool: false;
  runtimeApply: false;
  dbMutation: false;
};

type FixtureReport = {
  fixtures: Fixture[];
};

type Finding = {
  severity: "pass" | "warn" | "fail";
  fixtureId: string;
  lane: string;
  pid: string;
  title: string;
  reason: string;
};

type Report = {
  generatedAt: string;
  reportOnly: true;
  runtimeApply: false;
  publicPromotion: false;
  candidatePoolPolicyWiring: false;
  productionDbMutation: false;
  sourceReport: string;
  conclusion: string;
  metrics: {
    fixturesAudited: number;
    duplicatePidFindings: number;
    riskyPositiveFindings: number;
    boundaryFlagFindings: number;
    warningFindings: number;
    failFindings: number;
  };
  findings: Finding[];
  nextSteps: string[];
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const sourceRelativePath = "reports/live-read-regression-fixture-candidates-latest.json";
const outputJsonPath = path.join(reportsDir, "live-read-regression-fixture-audit-latest.json");
const outputMdPath = path.join(reportsDir, "live-read-regression-fixture-audit-latest.md");

const riskyPositive = /렌탈|대여|임대|사기|피해|주의|케이스|파우치|부품|소모품|도크만|본체만|삽니다|구합니다|가품|짭|고장|파손/i;

function renderMarkdown(report: Report) {
  const lines = [
    "# Live-Read Regression Fixture Audit",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- conclusion: ${report.conclusion}`,
    `- sourceReport: ${report.sourceReport}`,
    `- reportOnly: ${report.reportOnly}`,
    `- runtime/public/candidate/db mutation: ${report.runtimeApply}/${report.publicPromotion}/${report.candidatePoolPolicyWiring}/${report.productionDbMutation}`,
    "",
    "## Metrics",
    "",
    `- fixturesAudited: ${report.metrics.fixturesAudited}`,
    `- duplicatePidFindings: ${report.metrics.duplicatePidFindings}`,
    `- riskyPositiveFindings: ${report.metrics.riskyPositiveFindings}`,
    `- boundaryFlagFindings: ${report.metrics.boundaryFlagFindings}`,
    `- warningFindings: ${report.metrics.warningFindings}`,
    `- failFindings: ${report.metrics.failFindings}`,
    "",
    "## Findings",
    "",
    "| severity | lane | pid | reason | title |",
    "|---|---|---:|---|---|",
    ...report.findings.map((finding) =>
      `| ${finding.severity} | ${finding.lane} | ${finding.pid} | ${finding.reason} | ${finding.title.replaceAll("|", "/")} |`,
    ),
    "",
    "## Next Steps",
    "",
    ...report.nextSteps.map((item) => `- ${item}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const source = JSON.parse(await readFile(path.join(appDir, sourceRelativePath), "utf8")) as FixtureReport;
  const findings: Finding[] = [];
  const pidCounts = new Map<string, number>();
  for (const fixture of source.fixtures) pidCounts.set(fixture.pid, (pidCounts.get(fixture.pid) ?? 0) + 1);

  for (const fixture of source.fixtures) {
    if (pidCounts.get(fixture.pid)! > 1) {
      findings.push({
        severity: "warn",
        fixtureId: fixture.fixtureId,
        lane: fixture.lane,
        pid: fixture.pid,
        title: fixture.title,
        reason: "duplicate_pid_in_fixture_candidates",
      });
    }
    if (fixture.expectedRuntimeDisposition === "normal_candidate" && riskyPositive.test(fixture.title)) {
      findings.push({
        severity: "fail",
        fixtureId: fixture.fixtureId,
        lane: fixture.lane,
        pid: fixture.pid,
        title: fixture.title,
        reason: "risky_text_in_positive_fixture",
      });
    }
    if (fixture.runtimeApproved || fixture.publicPromotion || fixture.candidatePool || fixture.runtimeApply || fixture.dbMutation) {
      findings.push({
        severity: "fail",
        fixtureId: fixture.fixtureId,
        lane: fixture.lane,
        pid: fixture.pid,
        title: fixture.title,
        reason: "forbidden_boundary_flag_enabled",
      });
    }
  }

  if (!findings.length) {
    findings.push({
      severity: "pass",
      fixtureId: "all",
      lane: "all",
      pid: "-",
      title: "all fixture candidates",
      reason: "no_duplicate_no_risky_positive_no_boundary_flag",
    });
  }

  const duplicatePidFindings = findings.filter((finding) => finding.reason === "duplicate_pid_in_fixture_candidates").length;
  const riskyPositiveFindings = findings.filter((finding) => finding.reason === "risky_text_in_positive_fixture").length;
  const boundaryFlagFindings = findings.filter((finding) => finding.reason === "forbidden_boundary_flag_enabled").length;
  const failFindings = findings.filter((finding) => finding.severity === "fail").length;
  const warningFindings = findings.filter((finding) => finding.severity === "warn").length;

  const report: Report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    sourceReport: sourceRelativePath,
    conclusion: failFindings === 0
      ? "fixture_audit_passed_ready_for_owner_test_conversion_review"
      : "fixture_audit_failed_do_not_convert_to_tests",
    metrics: {
      fixturesAudited: source.fixtures.length,
      duplicatePidFindings,
      riskyPositiveFindings,
      boundaryFlagFindings,
      warningFindings,
      failFindings,
    },
    findings,
    nextSteps: failFindings === 0
      ? [
        "Owner can approve converting these fixture candidates into runtime tests only.",
        "Do not apply runtime parser/catalog changes until tests exist and pass.",
      ]
      : [
        "Fix failed fixture candidates before any test conversion.",
        "Re-run live-read regression fixture candidate generation after fixes.",
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
