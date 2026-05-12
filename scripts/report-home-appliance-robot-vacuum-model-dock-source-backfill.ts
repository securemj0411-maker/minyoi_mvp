import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ScopeReport = {
  reportOnly: boolean;
  conclusion: string;
  recommendedNextLane: string;
  boundary: Boundary;
  metrics: {
    robotVacuumContaminationRows: number;
    wetDryOrMopContaminationRows: number;
    sourceEvidenceRows: number;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    runtimeApplyRows: number;
  };
  laneEvidence: Array<{
    lane: string;
    recommendation: string;
    evidenceQuality: string;
    boundaryRule: string;
    sourceEvidence: EvidenceSource[];
  }>;
};

type Boundary = {
  reportOnly: boolean;
  runtimeCatalogApply: boolean;
  runtimeApply: boolean;
  publicPromotion: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  directThirtyDayPlanEdit: boolean;
  runtimeApprovedRows: number;
  publicPromotionRows: number;
  candidatePoolRows: number;
  runtimeApplyRows: number;
};

type EvidenceSource = {
  label: string;
  url: string;
  sourceType:
    | "official_product"
    | "official_support_pdf"
    | "official_support"
    | "official_manual"
    | "reliable_secondary";
  supports: string[];
  statusNote: string;
};

type HomeSample = {
  pid: string;
  title?: string;
  name?: string;
  price: number;
  condition: string;
  saleStatus?: string;
  url: string;
  description?: string;
};

type ModelEvidence = {
  modelKey: string;
  brand: string;
  displayModel: string;
  robotClass: "robot_vacuum" | "robot_vacuum_mop" | "robot_mop";
  dockAxis: "none_visible" | "charging_station" | "auto_empty_clean_base" | "mop_wash_base" | "steam_mop_station";
  sourceEvidence: EvidenceSource[];
  marketPids: string[];
  internalObservationStatus: "suitable_for_future_internal_observation" | "manual_until_dock_axis_clear";
};

type BoundarySeed = {
  caseId: string;
  pid: string | null;
  boundaryClass:
    | "accessory_only_dock_base"
    | "mop_pad_filter_consumable"
    | "sold_only_or_non_active"
    | "buying_request"
    | "damaged_or_parts"
    | "non_robot_vacuum";
  expectedDecision: "negative_hold" | "manual_hold";
  reason: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const samplesPath = "category-intelligence/home_appliance_tech_discovered/normalized_samples.json";

const outputBoundary = {
  reportOnly: true,
  runtimeCatalogApply: false,
  runtimeApply: false,
  publicPromotion: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
};

const modelEvidence: ModelEvidence[] = [
  {
    modelKey: "narwal_freo",
    brand: "Narwal",
    displayModel: "Freo",
    robotClass: "robot_vacuum_mop",
    dockAxis: "mop_wash_base",
    marketPids: ["405152030"],
    internalObservationStatus: "suitable_for_future_internal_observation",
    sourceEvidence: [
      {
        label: "Narwal Freo Korea official product page",
        url: "https://kr.narwal.com/products/narwal-freo",
        sourceType: "official_product",
        supports: ["Narwal Freo identity", "robot vacuum/mop class", "base station / mop cleaning axis"],
        statusNote: "Official regional product page supports robot-vacuum/mop model identity and base station separation.",
      },
    ],
  },
  {
    modelKey: "roborock_s8",
    brand: "Roborock",
    displayModel: "S8",
    robotClass: "robot_vacuum_mop",
    dockAxis: "charging_station",
    marketPids: [],
    internalObservationStatus: "manual_until_dock_axis_clear",
    sourceEvidence: [
      {
        label: "Roborock S8 official support manual",
        url: "https://support.roborock.com/hc/en-us/article_attachments/46135352812697",
        sourceType: "official_support_pdf",
        supports: ["Roborock S8 identity", "robotic vacuum cleaner class", "charging dock/manual axis"],
        statusNote: "Official support PDF is strong model evidence; current sample set lacks clean S8 live market row.",
      },
    ],
  },
  {
    modelKey: "lg_cordzero_r9",
    brand: "LG",
    displayModel: "CordZero R9 ThinQ",
    robotClass: "robot_vacuum",
    dockAxis: "charging_station",
    marketPids: [],
    internalObservationStatus: "manual_until_dock_axis_clear",
    sourceEvidence: [
      {
        label: "LG CordZero R9 ThinQ official product experience page",
        url: "https://www.lg.com/us/lg-thinq-appliances/m/products/lg-cordzero-r9-thinq/index.html",
        sourceType: "official_product",
        supports: ["LG CordZero R9 identity", "robot vacuum class"],
        statusNote: "Official LG evidence separates R9 from stick vacuum rows; live market rows in wave3 were bundle/parts contaminated.",
      },
    ],
  },
  {
    modelKey: "samsung_bespoke_ai_steam_ultra",
    brand: "Samsung",
    displayModel: "Bespoke AI Steam Ultra",
    robotClass: "robot_vacuum_mop",
    dockAxis: "steam_mop_station",
    marketPids: ["407281380"],
    internalObservationStatus: "suitable_for_future_internal_observation",
    sourceEvidence: [
      {
        label: "Samsung Bespoke AI Steam official product family page",
        url: "https://www.samsung.com/us/home-appliances/vacuums/robot-vacuums/",
        sourceType: "official_product",
        supports: ["Samsung robot vacuum family", "Bespoke AI Steam station axis", "robot vacuum class"],
        statusNote: "Official product-family evidence supports robot-vacuum/station class; exact SKU should be rechecked before executor design.",
      },
    ],
  },
  {
    modelKey: "xiaomi_mijia_stytj06zhm",
    brand: "Xiaomi",
    displayModel: "Mijia Pro STYTJ06ZHM",
    robotClass: "robot_vacuum_mop",
    dockAxis: "charging_station",
    marketPids: ["384427956"],
    internalObservationStatus: "suitable_for_future_internal_observation",
    sourceEvidence: [
      {
        label: "Xiaomi Mijia STYTJ06ZHM official/support manual mirror",
        url: "https://manuals.plus/mijia/stytj06zhm-robot-vacuum-mop-p-manual",
        sourceType: "reliable_secondary",
        supports: ["STYTJ06ZHM identity", "robot vacuum-mop class", "charging/station handling"],
        statusNote: "Fallback reliable manual mirror because official page availability is region-dependent; label as secondary.",
      },
    ],
  },
  {
    modelKey: "irobot_roomba_i_clean_base",
    brand: "iRobot",
    displayModel: "Roomba i Series Clean Base",
    robotClass: "robot_vacuum",
    dockAxis: "auto_empty_clean_base",
    marketPids: ["291363501"],
    internalObservationStatus: "manual_until_dock_axis_clear",
    sourceEvidence: [
      {
        label: "iRobot Clean Base official accessory page",
        url: "https://www.irobot.com/en_US/clean-base-automatic-dirt-disposal/4626191.html",
        sourceType: "official_product",
        supports: ["Clean Base identity", "auto-empty dock/accessory axis", "not robot body by itself"],
        statusNote: "Official evidence supports treating clean base as dock/accessory-only unless paired with robot body.",
      },
    ],
  },
  {
    modelKey: "everybot_3i_pop_rv200",
    brand: "Everybot",
    displayModel: "3i POP RV200",
    robotClass: "robot_vacuum_mop",
    dockAxis: "charging_station",
    marketPids: ["382932885", "407289960"],
    internalObservationStatus: "suitable_for_future_internal_observation",
    sourceEvidence: [
      {
        label: "Everybot 3i POP RV200 manufacturer product page",
        url: "https://www.everybot.co.kr/",
        sourceType: "official_product",
        supports: ["Everybot 3i POP / RV200 family identity", "robot cleaner class", "charger/station boundary"],
        statusNote: "Official manufacturer site is used as primary brand evidence; exact product URL may require regional navigation before executor design.",
      },
    ],
  },
];

const boundarySeeds: BoundarySeed[] = [
  {
    caseId: "ROBOT-BOUNDARY-ACCESSORY-01",
    pid: "291363501",
    boundaryClass: "accessory_only_dock_base",
    expectedDecision: "negative_hold",
    reason: "Clean Base/auto-empty station only; no robot body included.",
  },
  {
    caseId: "ROBOT-BOUNDARY-MOP-PAD-01",
    pid: "406585468",
    boundaryClass: "mop_pad_filter_consumable",
    expectedDecision: "negative_hold",
    reason: "Robot mop cloths/water-tank consumables are accessory-only.",
  },
  {
    caseId: "ROBOT-BOUNDARY-MOP-PAD-02",
    pid: "279832779",
    boundaryClass: "mop_pad_filter_consumable",
    expectedDecision: "negative_hold",
    reason: "Bespoke Jet mop brush and cloth kit is consumable/accessory inventory and not robot vacuum body.",
  },
  {
    caseId: "ROBOT-BOUNDARY-SOLD-ONLY-01",
    pid: "226330643",
    boundaryClass: "sold_only_or_non_active",
    expectedDecision: "negative_hold",
    reason: "Filter listing has partial sold-only inventory markers and is not active robot body evidence.",
  },
  {
    caseId: "ROBOT-BOUNDARY-BUYING-01",
    pid: null,
    boundaryClass: "buying_request",
    expectedDecision: "negative_hold",
    reason: "No current buying-request row found in the sampled evidence, but wanted/buying rows must stay excluded if observed.",
  },
  {
    caseId: "ROBOT-BOUNDARY-DAMAGED-01",
    pid: "406210679",
    boundaryClass: "damaged_or_parts",
    expectedDecision: "negative_hold",
    reason: "Roborock robot row lacks charger and is parts/unknown-condition inventory.",
  },
  {
    caseId: "ROBOT-BOUNDARY-DAMAGED-02",
    pid: "382932885",
    boundaryClass: "damaged_or_parts",
    expectedDecision: "manual_hold",
    reason: "Everybot robot body and station are listed, but description says it does not work; keep manual/hold.",
  },
  {
    caseId: "ROBOT-BOUNDARY-NON-ROBOT-01",
    pid: "407290496",
    boundaryClass: "non_robot_vacuum",
    expectedDecision: "negative_hold",
    reason: "Portable/handheld vacuum is not robot vacuum despite vacuum category overlap.",
  },
  {
    caseId: "ROBOT-BOUNDARY-NON-ROBOT-02",
    pid: "407297623",
    boundaryClass: "non_robot_vacuum",
    expectedDecision: "negative_hold",
    reason: "Bedding cleaner is a separate cleaner subtype.",
  },
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

function titleOf(sample: HomeSample): string {
  return sample.title ?? sample.name ?? "";
}

function snippet(sample: HomeSample): string {
  return (sample.description ?? "").replace(/\s+/g, " ").trim().slice(0, 220);
}

function sampleByPid(samples: HomeSample[], pid: string | null): HomeSample | null {
  if (!pid) return null;
  return samples.find((sample) => sample.pid === pid) ?? null;
}

function countBy(values: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].map(([key, count]) => ({ key, count }));
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const [scope, samples] = await Promise.all([
    readJson<ScopeReport>("reports/home-appliance-scope-redefinition-source-backfill-latest.json"),
    readJson<HomeSample[]>(samplesPath),
  ]);

  const robotScope = scope.laneEvidence.find((lane) => lane.lane === "robot_vacuum");
  if (!robotScope) throw new Error("Missing robot_vacuum lane evidence in scope redefinition report");

  const marketRows = modelEvidence.flatMap((model) =>
    model.marketPids.map((pid) => {
      const sample = sampleByPid(samples, pid);
      if (!sample) throw new Error(`Missing home appliance sample pid=${pid}`);
      return {
        modelKey: model.modelKey,
        brand: model.brand,
        displayModel: model.displayModel,
        robotClass: model.robotClass,
        dockAxis: model.dockAxis,
        pid,
        title: titleOf(sample),
        price: sample.price,
        condition: sample.condition,
        saleStatus: sample.saleStatus ?? "UNKNOWN",
        url: sample.url,
        evidenceSnippet: snippet(sample),
      };
    }),
  );

  const boundaryRows = boundarySeeds.map((seed) => {
    const sample = sampleByPid(samples, seed.pid);
    return {
      ...seed,
      title: sample ? titleOf(sample) : "no current sampled buying-request row",
      price: sample?.price ?? null,
      condition: sample?.condition ?? null,
      saleStatus: sample?.saleStatus ?? null,
      url: sample?.url ?? null,
      evidenceSnippet: sample ? snippet(sample) : "Policy boundary carried from governing work order; no current buying-request sample row found.",
    };
  });

  const sourceRows = modelEvidence.flatMap((model) =>
    model.sourceEvidence.map((source) => ({
      modelKey: model.modelKey,
      brand: model.brand,
      displayModel: model.displayModel,
      robotClass: model.robotClass,
      dockAxis: model.dockAxis,
      ...source,
    })),
  );

  const checks = [
    {
      id: "ROBOT-SOURCE-01",
      status: scope.recommendedNextLane === "robot_vacuum_model_dock_source_backfill" ? "pass" : "fail",
      check: "scope redefinition selects robot vacuum model+dock source backfill",
      detail: scope.recommendedNextLane,
    },
    {
      id: "ROBOT-SOURCE-02",
      status: scope.metrics.robotVacuumContaminationRows >= 9 ? "pass" : "fail",
      check: "wave evidence has strong robot vacuum contamination signal",
      detail: `robotVacuumContaminationRows=${scope.metrics.robotVacuumContaminationRows}`,
    },
    {
      id: "ROBOT-SOURCE-03",
      status: sourceRows.length >= 6 && sourceRows.some((row) => row.sourceType === "official_product") ? "pass" : "fail",
      check: "robot model/dock source evidence exists and is primarily official",
      detail: `sourceRows=${sourceRows.length}`,
    },
    {
      id: "ROBOT-SOURCE-04",
      status: ["accessory_only_dock_base", "mop_pad_filter_consumable", "sold_only_or_non_active", "buying_request", "damaged_or_parts", "non_robot_vacuum"].every((key) =>
        boundaryRows.some((row) => row.boundaryClass === key),
      )
        ? "pass"
        : "fail",
      check: "required boundary classes are represented",
      detail: countBy(boundaryRows.map((row) => row.boundaryClass)).map((row) => `${row.key}:${row.count}`).join(", "),
    },
    {
      id: "ROBOT-SOURCE-05",
      status: scope.boundary.runtimeApprovedRows === 0 &&
        scope.boundary.publicPromotionRows === 0 &&
        scope.boundary.candidatePoolRows === 0 &&
        scope.boundary.runtimeApplyRows === 0
        ? "pass"
        : "fail",
      check: "scope boundary stays closed",
      detail: "runtime/public/candidate/runtimeApply=0/0/0/0",
    },
  ];
  const failedChecks = checks.filter((check) => check.status === "fail");
  const suitableForFutureInternalObservationPlanning = failedChecks.length === 0;

  const report = {
    generatedAt,
    category: "home_appliance_tech_discovered",
    lane: "robot_vacuum_model_dock_source_backfill",
    reportOnly: true,
    conclusion: suitableForFutureInternalObservationPlanning
      ? "robot_vacuum_model_dock_source_backfill_suitable_for_future_internal_observation_only"
      : "robot_vacuum_model_dock_source_backfill_blocked",
    suitableForFutureInternalObservationPlanning,
    sufficientForRuntimePatch: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    runtimeApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    boundary: outputBoundary,
    metrics: {
      modelEvidenceRows: modelEvidence.length,
      marketRows: marketRows.length,
      sourceRows: sourceRows.length,
      officialProductRows: sourceRows.filter((row) => row.sourceType === "official_product").length,
      officialSupportOrManualRows: sourceRows.filter((row) => row.sourceType === "official_support_pdf" || row.sourceType === "official_support" || row.sourceType === "official_manual").length,
      reliableSecondaryRows: sourceRows.filter((row) => row.sourceType === "reliable_secondary").length,
      dockAxisCounts: countBy(modelEvidence.map((model) => model.dockAxis)),
      boundaryRows: boundaryRows.length,
      boundaryClassCounts: countBy(boundaryRows.map((row) => row.boundaryClass)),
      checks: checks.length,
      failedChecks: failedChecks.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      runtimeApplyRows: 0,
    },
    sourceScopeInput: {
      conclusion: scope.conclusion,
      recommendedNextLane: scope.recommendedNextLane,
      robotScope,
    },
    modelEvidence,
    sourceRows,
    marketRows,
    boundaryRows,
    modelDockPolicy: [
      "Comparable identity must include robot brand/model and dock/base/mop station axis before any future observation executor.",
      "Robot body without dock/base evidence is not comparable with robot+dock bundles.",
      "Auto-empty clean base, mop washing base, steam mop station, and plain charging station are separate package axes.",
      "Dock/base-only rows are accessory-only unless a robot body is included.",
      "Damaged/parts rows are hold even when model identity is visible.",
    ],
    blockedHoldBoundaries: [
      "accessory-only dock/base station",
      "mop pad/filter/consumable rows",
      "sold-only or non-active rows",
      "buying/wanted rows",
      "damaged or parts-only rows",
      "non-robot vacuum rows including stick, handheld, bedding, wet-dry, and unrelated appliances",
    ],
    checks,
    failedChecks,
    inputFiles: [
      "reports/home-appliance-scope-redefinition-source-backfill-latest.json",
      samplesPath,
    ],
    nextAction:
      "Use this only to design a future report-only internal observation plan for robot_vacuum_model_dock; do not runtime-wire or public-promote.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "home-appliance-robot-vacuum-model-dock-source-backfill-latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  const md = [
    "# Home Appliance Robot Vacuum Model+Dock Source Backfill",
    "",
    `- generatedAt: ${generatedAt}`,
    `- category: ${report.category}`,
    `- lane: ${report.lane}`,
    `- conclusion: ${report.conclusion}`,
    `- suitableForFutureInternalObservationPlanning: ${report.suitableForFutureInternalObservationPlanning}`,
    "- sufficientForRuntimePatch: false",
    "",
    "## Boundary",
    "",
    "- reportOnly: true",
    "- runtimeCatalogApply/runtimeApply/publicPromotion/candidatePoolPolicyWiring: false/false/false/false",
    "- runtimeApproved/publicPromotion/candidatePool/runtimeApply rows: 0/0/0/0",
    "- productionDbMutation: false",
    "- directThirtyDayPlanEdit: false",
    "",
    "## Metrics",
    "",
    table(
      ["metric", "value"],
      [
        ["modelEvidenceRows", report.metrics.modelEvidenceRows],
        ["marketRows", report.metrics.marketRows],
        ["sourceRows", report.metrics.sourceRows],
        ["officialProductRows", report.metrics.officialProductRows],
        ["officialSupportOrManualRows", report.metrics.officialSupportOrManualRows],
        ["reliableSecondaryRows", report.metrics.reliableSecondaryRows],
        ["boundaryRows", report.metrics.boundaryRows],
        ["checks", report.metrics.checks],
        ["failedChecks", report.metrics.failedChecks],
      ],
    ),
    "",
    "## Model + Dock Evidence",
    "",
    table(
      ["modelKey", "brand", "model", "robotClass", "dockAxis", "status"],
      modelEvidence.map((row) => [
        row.modelKey,
        row.brand,
        row.displayModel,
        row.robotClass,
        row.dockAxis,
        row.internalObservationStatus,
      ]),
    ),
    "",
    "## Source Evidence",
    "",
    table(
      ["modelKey", "sourceType", "label", "url", "supports", "statusNote"],
      sourceRows.map((row) => [
        row.modelKey,
        row.sourceType,
        row.label,
        row.url,
        row.supports.join("; "),
        row.statusNote,
      ]),
    ),
    "",
    "## Market Evidence Rows",
    "",
    table(
      ["modelKey", "pid", "dockAxis", "condition", "saleStatus", "price", "title"],
      marketRows.map((row) => [
        row.modelKey,
        row.pid,
        row.dockAxis,
        row.condition,
        row.saleStatus,
        row.price,
        row.title,
      ]),
    ),
    "",
    "## Boundary Rows",
    "",
    table(
      ["caseId", "pid", "class", "decision", "condition", "saleStatus", "title", "reason"],
      boundaryRows.map((row) => [
        row.caseId,
        row.pid ?? "none",
        row.boundaryClass,
        row.expectedDecision,
        row.condition ?? "none",
        row.saleStatus ?? "none",
        row.title,
        row.reason,
      ]),
    ),
    "",
    "## Model Dock Policy",
    "",
    ...report.modelDockPolicy.map((item) => `- ${item}`),
    "",
    "## Blocked / Hold Boundaries",
    "",
    ...report.blockedHoldBoundaries.map((item) => `- ${item}`),
    "",
    "## Checks",
    "",
    table(
      ["id", "status", "check", "detail"],
      checks.map((check) => [check.id, check.status, check.check, check.detail]),
    ),
    "",
    "## Inputs Read",
    "",
    ...report.inputFiles.map((file) => `- ${file}`),
    "",
    "## Next Action",
    "",
    report.nextAction,
    "",
  ].join("\n");

  await writeFile(path.join(reportsDir, "home-appliance-robot-vacuum-model-dock-source-backfill-latest.md"), md);

  console.log(JSON.stringify({
    report: "reports/home-appliance-robot-vacuum-model-dock-source-backfill-latest",
    conclusion: report.conclusion,
    suitableForFutureInternalObservationPlanning,
    modelEvidenceRows: report.metrics.modelEvidenceRows,
    sourceRows: report.metrics.sourceRows,
    marketRows: report.metrics.marketRows,
    boundaryRows: report.metrics.boundaryRows,
    failedChecks: report.metrics.failedChecks,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolRows: 0,
    runtimeApplyRows: 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
