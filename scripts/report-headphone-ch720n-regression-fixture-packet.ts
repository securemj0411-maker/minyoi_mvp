import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type LaneRow = {
  pid: number;
  title: string;
  price: number;
  detailListingType: string;
  saleStatus: string | null;
  detailNeedsReview: boolean;
  detailComparableKey: string | null;
};

type HeldReview = {
  laneReports: Array<{
    sku: string;
    activeCleanRows: LaneRow[];
    activeProblemRows: LaneRow[];
  }>;
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, file), "utf8")) as T;
}

function compact(text: unknown, limit = 78) {
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

function expectedDecision(row: LaneRow, isPositive: boolean) {
  if (isPositive) return "candidate_positive";
  if (row.detailListingType === "damaged" || row.detailListingType === "accessory" || row.detailListingType === "callout") return "hold";
  return "manual_review";
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const held = await readJson<HeldReview>("reports/headphone-held-lane-guardrail-review-latest.json");
  const lane = held.laneReports.find((row) => row.sku === "sony-wh-ch720n");
  if (!lane) throw new Error("sony-wh-ch720n lane missing");
  const positiveFixtures = lane.activeCleanRows.slice(0, 10).map((row) => ({
    ...row,
    expectedDecision: expectedDecision(row, true),
    fixtureType: "positive_active_clean",
  }));
  const negativeFixtures = lane.activeProblemRows.map((row) => ({
    ...row,
    expectedDecision: expectedDecision(row, false),
    fixtureType: "negative_active_problem",
  }));
  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    runtimePatchApplied: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    category: "headphone_discovered",
    sku: "sony-wh-ch720n",
    metrics: {
      positiveFixtures: positiveFixtures.length,
      negativeFixtures: negativeFixtures.length,
      totalFixtures: positiveFixtures.length + negativeFixtures.length,
    },
    positiveFixtures,
    negativeFixtures,
    requiredAssertions: [
      "Positive CH720N active clean rows must remain candidate_positive.",
      "Active damaged/accessory/callout rows must be held.",
      "Any CH720N guard based on price must not alone block normal clean rows above the low-price threshold.",
      "The guard must use detail context when available; title-only guard is too risky for CH720N.",
    ],
    decision: "sony_wh_ch720n_regression_fixture_packet_ready",
    nextStep:
      "Use this fixture packet before any CH720N runtime guard or acquisition inclusion.",
  };
  await writeFile(path.join(reportsDir, "headphone-ch720n-regression-fixture-packet-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    "# Headphone CH720N Regression Fixture Packet",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- runtimePatchApplied: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision}`,
    "",
    "## Metrics",
    "",
    `- positiveFixtures: ${report.metrics.positiveFixtures}`,
    `- negativeFixtures: ${report.metrics.negativeFixtures}`,
    `- totalFixtures: ${report.metrics.totalFixtures}`,
    "",
    "## Positive Fixtures",
    "",
    mdTable(
      ["pid", "title", "price", "expected", "key"],
      positiveFixtures.map((row) => [row.pid, compact(row.title), row.price, row.expectedDecision, row.detailComparableKey ?? ""]),
    ),
    "",
    "## Negative Fixtures",
    "",
    mdTable(
      ["pid", "title", "price", "detailType", "expected"],
      negativeFixtures.map((row) => [row.pid, compact(row.title), row.price, row.detailListingType, row.expectedDecision]),
    ),
    "",
    "## Required Assertions",
    "",
    ...report.requiredAssertions.map((assertion) => `- ${assertion}`),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "headphone-ch720n-regression-fixture-packet-latest.md"), `${md}\n`);
  console.log(
    `headphone CH720N regression fixtures: positive=${positiveFixtures.length}, negative=${negativeFixtures.length}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
