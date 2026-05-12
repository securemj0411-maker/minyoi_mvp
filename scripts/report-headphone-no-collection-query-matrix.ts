import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type MiningTargets = {
  targets: Array<{
    brandOrFamily: string;
    priority: "high" | "medium";
    targetQueries: string[];
    expectedLane: string;
    minimumUsefulRows: number;
  }>;
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const miningTargets = await readJson<MiningTargets>(path.join(reportsDir, "headphone-broader-sample-mining-targets-latest.json"));

  const matrixRows = miningTargets.targets.flatMap((target) =>
    target.targetQueries.map((query, index) => ({
      id: `${target.brandOrFamily.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${String(index + 1).padStart(2, "0")}`,
      brandOrFamily: target.brandOrFamily,
      priority: target.priority,
      query,
      expectedLane: target.expectedLane,
      targetRows: Math.ceil(target.minimumUsefulRows / target.targetQueries.length),
      collectionApproved: false,
      outputExpectation: "report-only sample evidence row if future collection is approved",
    })),
  );

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    scope: "No-collection query matrix for broader headphone sample mining targets",
    inputFiles: ["reports/headphone-broader-sample-mining-targets-latest.json"],
    metrics: {
      targetFamilies: miningTargets.targets.length,
      queryRows: matrixRows.length,
      approvedCollectionRows: matrixRows.filter((row) => row.collectionApproved).length,
      plannedTargetRows: matrixRows.reduce((sum, row) => sum + row.targetRows, 0),
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    matrixRows,
    approvalRequiredForCollection: true,
    forbiddenWithoutApproval: [
      "live Bunjang/API collection",
      "production DB writes",
      "runtime parser/catalog changes",
      "candidate-pool wiring",
      "public promotion",
    ],
    nextStep: "Stop before live collection, or request explicit approval for report-only sample collection.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-no-collection-query-matrix-latest.json"), JSON.stringify(report, null, 2));

  const rows = matrixRows.map((row) => `| ${row.id} | ${row.priority} | ${row.brandOrFamily} | ${row.query} | ${row.expectedLane} | ${row.targetRows} | ${row.collectionApproved ? "yes" : "no"} |`);
  const md = [
    "# Headphone No-Collection Query Matrix",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only query matrix for broader headphone sample mining. This does not run live collection.",
    "",
    "## Metrics",
    "",
    `- target families: ${report.metrics.targetFamilies}`,
    `- query rows: ${report.metrics.queryRows}`,
    `- approved collection rows: ${report.metrics.approvedCollectionRows}`,
    `- planned target rows: ${report.metrics.plannedTargetRows}`,
    `- runtime-approved/public/candidate-pool rows: ${report.metrics.runtimeApprovedRows}/${report.metrics.publicPromotionRows}/${report.metrics.candidatePoolWiringRows}`,
    "",
    "## Query Matrix",
    "",
    "| id | priority | brand_or_family | query | expected_lane | target_rows | collection_approved |",
    "| --- | --- | --- | --- | --- | ---: | --- |",
    ...rows,
    "",
    "## Forbidden Without Approval",
    "",
    ...report.forbiddenWithoutApproval.map((item) => `- ${item}`),
    "",
    "## Next Step",
    "",
    report.nextStep,
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-no-collection-query-matrix-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-no-collection-query-matrix-latest.json");
  console.log("wrote reports/headphone-no-collection-query-matrix-latest.md");
  console.log(`headphone no-collection query matrix: queries=${matrixRows.length}, approved_collection=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
