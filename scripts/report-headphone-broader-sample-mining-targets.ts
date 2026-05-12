import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type DecisionBrief = {
  recommendation: string;
};

type MiningTarget = {
  brandOrFamily: string;
  priority: "high" | "medium";
  targetQueries: string[];
  evidenceNeed: string;
  expectedLane: "unknown_brand_sku_guardrail" | "known_brand_model_review" | "accessory_exclusion_guardrail";
  minimumUsefulRows: number;
  why: string;
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const brief = await readJson<DecisionBrief>(path.join(reportsDir, "headphone-report-only-owner-decision-brief-latest.json"));

  const targets: MiningTarget[] = [
    {
      brandOrFamily: "Razer BlackShark",
      priority: "high",
      targetQueries: ["레이저 블랙샤크 V3", "Razer BlackShark V3", "블랙샤크 hyperspeed", "BlackShark HyperSpeed"],
      evidenceNeed: "Separate BlackShark V3, V3 X HyperSpeed, and accessory/headset-only wording.",
      expectedLane: "known_brand_model_review",
      minimumUsefulRows: 20,
      why: "Current row has official source but exact local title-to-SKU mapping is not stable.",
    },
    {
      brandOrFamily: "Beats",
      priority: "high",
      targetQueries: ["비츠 EP", "beats EP", "닥터드레 EP", "비츠 온이어 헤드폰", "beats 헤드폰"],
      evidenceNeed: "Separate Beats EP, generic Beats, older Beats by Dr. Dre wording, and earphone/headphone ambiguity.",
      expectedLane: "unknown_brand_sku_guardrail",
      minimumUsefulRows: 20,
      why: "Official support exists, but marketplace title normalization is unclear.",
    },
    {
      brandOrFamily: "B&O / Bang & Olufsen",
      priority: "medium",
      targetQueries: ["뱅앤올룹슨 헤드폰", "B&O 헤드폰", "Bang Olufsen headphones", "beoplay hx", "beoplay h95"],
      evidenceNeed: "Model-specific rows for Beoplay families plus accessory/earpad exclusions.",
      expectedLane: "known_brand_model_review",
      minimumUsefulRows: 15,
      why: "Mentioned as deferred unknown branded headphone SKU expansion.",
    },
    {
      brandOrFamily: "Logitech / Corsair gaming headsets",
      priority: "medium",
      targetQueries: ["로지텍 헤드셋", "logitech headset", "커세어 헤드셋", "corsair headset"],
      evidenceNeed: "Distinguish gaming headset models from generic headset terms and accessories.",
      expectedLane: "known_brand_model_review",
      minimumUsefulRows: 20,
      why: "Gaming headset brand rows are likely common and can contaminate generic headphone keys.",
    },
    {
      brandOrFamily: "Headphone accessories",
      priority: "medium",
      targetQueries: ["헤드폰 이어쿠션", "에어팟 맥스 케이스", "헤드폰 케이스", "헤드셋 쿠션"],
      evidenceNeed: "Negative examples for cushions, cases, boxes, adapters, and repair parts.",
      expectedLane: "accessory_exclusion_guardrail",
      minimumUsefulRows: 20,
      why: "Accessory contamination already appeared in Bose and AirPods Max hold rows.",
    },
  ];

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    scope: "Broader headphone sample mining target plan",
    inputFiles: ["reports/headphone-report-only-owner-decision-brief-latest.json"],
    metrics: {
      targets: targets.length,
      highPriorityTargets: targets.filter((row) => row.priority === "high").length,
      mediumPriorityTargets: targets.filter((row) => row.priority === "medium").length,
      minimumUsefulRowsTotal: targets.reduce((sum, row) => sum + row.minimumUsefulRows, 0),
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    decisionBriefRecommendation: brief.recommendation,
    targets,
    boundary: [
      "This is a target plan only and does not run live collection.",
      "No production DB writes, runtime wiring, public promotion, or candidate-pool changes are allowed.",
      "Mined rows, if collected later, must remain report-only until owner review.",
    ],
    nextStep: "Create a no-collection query matrix/checklist, or get explicit approval for actual sample collection.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-broader-sample-mining-targets-latest.json"), JSON.stringify(report, null, 2));

  const rows = targets.map((row) => `| ${row.priority} | ${row.brandOrFamily} | ${row.expectedLane} | ${row.minimumUsefulRows} | ${row.targetQueries.join("<br>").replace(/\|/g, "/")} | ${row.evidenceNeed.replace(/\|/g, "/")} |`);
  const md = [
    "# Headphone Broader Sample Mining Targets",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only target plan for broader headphone sample mining. This does not run live collection.",
    "",
    "## Metrics",
    "",
    `- targets: ${report.metrics.targets}`,
    `- high/medium priority: ${report.metrics.highPriorityTargets}/${report.metrics.mediumPriorityTargets}`,
    `- minimum useful rows total: ${report.metrics.minimumUsefulRowsTotal}`,
    `- runtime-approved/public/candidate-pool rows: ${report.metrics.runtimeApprovedRows}/${report.metrics.publicPromotionRows}/${report.metrics.candidatePoolWiringRows}`,
    "",
    "## Targets",
    "",
    "| priority | brand_or_family | expected_lane | min_rows | target_queries | evidence_need |",
    "| --- | --- | --- | ---: | --- | --- |",
    ...rows,
    "",
    "## Boundary",
    "",
    ...report.boundary.map((item) => `- ${item}`),
    "",
    "## Next Step",
    "",
    report.nextStep,
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-broader-sample-mining-targets-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-broader-sample-mining-targets-latest.json");
  console.log("wrote reports/headphone-broader-sample-mining-targets-latest.md");
  console.log(`headphone broader sample mining targets: targets=${targets.length}, min_rows=${report.metrics.minimumUsefulRowsTotal}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
