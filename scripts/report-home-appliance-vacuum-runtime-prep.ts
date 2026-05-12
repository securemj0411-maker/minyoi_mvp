import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ModelSubtypeRow = {
  key: string;
  count: number;
  subtype: "stick_or_handheld_vacuum" | "robot_vacuum";
  status: string;
  testCandidateStatus: string;
  brand: string;
  modelToken: string;
  subtypeBoundaryClass: string;
  reportOnlyAction: string;
  runtimeApproved: false;
};

type ModelSubtypeReport = {
  metrics: {
    modelReadyRows: number;
    stickOrHandheldRows: number;
    stickOrHandheldUnits: number;
    robotVacuumRows: number;
    robotVacuumUnits: number;
    logisticsRiskCount: number;
    runtimeApprovedRows: number;
  };
  rows: ModelSubtypeRow[];
};

type GenericVacuumRow = {
  pid?: string;
  title?: string;
  price?: number;
  genericClass: string;
  action: string;
  exclusionCandidateOnly: true;
  runtimeApproved: false;
};

type GenericVacuumReport = {
  metrics: {
    expandedGenericVacuumRows: number;
    logisticsRiskCount: number;
    logisticsRiskExamplesAvailable: number;
    exclusionCandidateOnlyRows: number;
    runtimeApprovedRows: number;
  };
  rows: GenericVacuumRow[];
};

type SampleRow = {
  pid: string;
  name: string;
  price: number;
  freeShipping: boolean;
  description: string;
  condition: string;
  saleStatus: string;
};

type SubtypePrepRow = {
  subtype: string;
  lane: "later_selected_subset_review" | "manual_review_needed" | "hold_or_exclusion";
  sampleEvidence: string[];
  keySignals: string[];
  holdSignals: string[];
  implementationPrepNote: string;
};

type ReviewCandidate = {
  key: string;
  subtype: string;
  sourceCount: number;
  stability: "medium" | "low";
  laterReviewLane: "later_selected_subset_review";
  blockedBy: string[];
};

type LogisticsRow = {
  pid: string;
  title: string;
  price: number;
  freeShipping: boolean;
  signals: string[];
};

const reportsDir = path.join(process.cwd(), "reports");
const categoryDir = path.join(process.cwd(), "category-intelligence", "home_appliance_tech_discovered");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function findRows(rows: GenericVacuumRow[], genericClass: string, limit: number): string[] {
  return rows
    .filter((row) => row.genericClass === genericClass)
    .slice(0, limit)
    .map((row) => row.title ?? row.pid ?? genericClass);
}

function detectLogisticsSignals(sample: SampleRow): string[] {
  const text = `${sample.name}\n${sample.description}`;
  const signals = [
    { token: "택배", label: "parcel_shipping" },
    { token: "착불", label: "collect_on_delivery" },
    { token: "발송", label: "shipping_dispatch" },
    { token: "우체국", label: "postal_shipping" },
    { token: "직거래", label: "local_pickup" },
    { token: "반값택배", label: "budget_parcel" },
    { token: "추가", label: "extra_fee_or_add_on" },
  ];

  return signals.filter(({ token }) => text.includes(token)).map(({ label }) => label);
}

function markdownList(lines: string[]): string[] {
  return lines.map((line) => `- ${line}`);
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const modelSubtype = await readJson<ModelSubtypeReport>(
    path.join(reportsDir, "home-appliance-vacuum-model-subtype-boundary-evidence-latest.json"),
  );
  const genericVacuum = await readJson<GenericVacuumReport>(
    path.join(reportsDir, "home-appliance-generic-vacuum-exclusion-readiness-latest.json"),
  );
  const samples = await readJson<SampleRow[]>(path.join(categoryDir, "samples.json"));

  const stickRows = modelSubtype.rows.filter((row) => row.subtype === "stick_or_handheld_vacuum");
  const robotRows = modelSubtype.rows.filter((row) => row.subtype === "robot_vacuum");
  const logisticsRows: LogisticsRow[] = samples
    .map((sample) => ({
      pid: sample.pid,
      title: sample.name,
      price: sample.price,
      freeShipping: sample.freeShipping,
      signals: detectLogisticsSignals(sample),
    }))
    .filter((row) => row.signals.length > 0)
    .slice(0, 8);

  const subtypePrepRows: SubtypePrepRow[] = [
    {
      subtype: "stick_handheld_vacuum",
      lane: "later_selected_subset_review",
      sampleEvidence: stickRows.map((row) => `${row.brand} ${row.modelToken}`),
      keySignals: ["brand + model/series token", "wireless/stick/handheld vacuum wording", "full-unit context"],
      holdSignals: ["brand-only vacuum title", "battery/charger/stand-only wording", "price add-on for charger or dock"],
      implementationPrepNote: "Best future narrow lane, but still reference-only until owner/main review and official/spec source backfill.",
    },
    {
      subtype: "robot_vacuum",
      lane: "manual_review_needed",
      sampleEvidence: [
        ...robotRows.map((row) => `${row.brand} ${row.modelToken}`),
        ...findRows(genericVacuum.rows, "robot_vacuum_generic", 3),
      ],
      keySignals: ["robot vacuum wording", "brand + model token", "dock/base-station/water-mop package axis"],
      holdSignals: ["battery-new wording without full-unit proof", "mop cloth/water tank/clean-base-only title", "generic robot vacuum family"],
      implementationPrepNote: "Must remain separate from stick/handheld comparables; dock/base-station bundle policy is unresolved.",
    },
    {
      subtype: "bedding_cleaner",
      lane: "hold_or_exclusion",
      sampleEvidence: findRows(genericVacuum.rows, "bedding_cleaner_generic", 4),
      keySignals: ["침구청소기", "bedding cleaner brand/family"],
      holdSignals: ["generic bedding cleaner title", "brand-only bedding cleaner", "voltage/converter caveat"],
      implementationPrepNote: "Vacuum-adjacent but not comparable to stick/handheld or robot vacuum rows.",
    },
    {
      subtype: "wet_dry_cleaner",
      lane: "hold_or_exclusion",
      sampleEvidence: ["새)물탱크.로봇청소포.물걸레로봇청소기.세라봇.", "샤오미 미지아 프로 물걸레 로봇청소기 stytj06zhm"],
      keySignals: ["물걸레", "물탱크", "건식/습식 cleaning supply wording"],
      holdSignals: ["mop cloth consumable", "water tank only", "robot wet-mop hybrid without full model/package axis"],
      implementationPrepNote: "Observed evidence is mostly consumable or robot-hybrid pressure, so this is not a positive subtype lane yet.",
    },
    {
      subtype: "dock_base_station_bundle",
      lane: "hold_or_exclusion",
      sampleEvidence: ["아이로봇 룸바 i 시리즈 클린베이스(자동먼지통)", "비스포크제트 액세서리 거치대 크래들 홀더 미개봉 새제품 본문필독"],
      keySignals: ["클린베이스", "자동먼지통", "거치대", "크래들", "스테이션"],
      holdSignals: ["base-only wording", "holder-only wording", "compatible-with wording"],
      implementationPrepNote: "Separate package/accessory axis is required before any robot or stick vacuum comparable key can consume these rows.",
    },
    {
      subtype: "accessory_parts_consumable",
      lane: "hold_or_exclusion",
      sampleEvidence: [
        ...findRows(genericVacuum.rows, "accessory_or_parts_risk", 2),
        "삼성 비스포크제트 배터리",
        "비스포크제트 물걸레브러쉬 거의 새제품급 다회용걸레 미개봉새제품 4장 포함",
      ],
      keySignals: ["battery", "charger/adapter", "brush", "filter", "cloth", "stand/holder"],
      holdSignals: ["part-only", "consumable quantity", "compatible accessory"],
      implementationPrepNote: "Hard exclusion from full-unit vacuum comparables; useful as regression fixture material only.",
    },
  ];

  const reviewCandidates: ReviewCandidate[] = modelSubtype.rows.map((row) => ({
    key: row.key,
    subtype: row.subtype,
    sourceCount: row.count,
    stability: row.count >= 2 ? "medium" : "low",
    laterReviewLane: "later_selected_subset_review",
    blockedBy: [
      "main/owner approval absent",
      "official/spec source backfill absent",
      row.subtype === "robot_vacuum" ? "dock/base-station package axis unresolved" : "accessory/full-unit boundary unresolved",
      "runtime parser/catalog edits forbidden in this packet",
    ],
  }));

  const report = {
    generatedAt,
    category: "home_appliance_tech_discovered",
    scope: "Agent D home appliance vacuum runtime prep; split architecture only",
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    runtimeApprovedRows: 0,
    candidatePositiveOnlyRows: 0,
    sourceReportsRead: [
      "reports/category-wide-runtime-rollout-plan-2026-05-12.md",
      "reports/subagent-implementation-prep-next-gate-latest.md",
      "reports/category-runtime-readiness-board-latest.md",
      "reports/pass-category-expansion-rollup-latest.md",
      "reports/home-appliance-vacuum-subtype-fixture-packet-latest.md/json",
      "reports/home-appliance-vacuum-subtype-split-prep-latest.md/json",
      "reports/home-appliance-no-mutation-runtime-dry-run-latest.md/json",
      "reports/home-appliance-artifact-consistency-audit-latest.md/json",
      "category-intelligence/home_appliance_tech_discovered/samples.json",
    ],
    metrics: {
      modelReadyRows: modelSubtype.metrics.modelReadyRows,
      stickOrHandheldRows: modelSubtype.metrics.stickOrHandheldRows,
      robotVacuumRows: modelSubtype.metrics.robotVacuumRows,
      genericVacuumRows: genericVacuum.metrics.expandedGenericVacuumRows,
      exclusionCandidateOnlyRows: genericVacuum.metrics.exclusionCandidateOnlyRows,
      inheritedLogisticsRiskCount: modelSubtype.metrics.logisticsRiskCount,
      rowLevelLogisticsExamplesPrepared: logisticsRows.length,
      subtypePrepRows: subtypePrepRows.length,
      laterSelectedSubsetReviewRows: reviewCandidates.length,
      runtimeApprovedRows: 0,
      candidatePositiveOnlyRows: 0,
    },
    subtypePrepRows,
    laterSelectedSubsetReviewCandidates: reviewCandidates,
    logisticsAndShippingHeavyRows: logisticsRows,
    blockedOwnerDecisions: [
      "Choose whether stick/handheld exact-model rows should be the first narrow home-appliance subset after official/spec evidence backfill.",
      "Define robot vacuum dock/base-station/package axes before robot rows can move beyond manual review.",
      "Decide whether wet/dry or bedding cleaners are separate future categories or permanent exclusions for this MVP lane.",
      "Define shipping/logistics handling for bulky appliance rows before any candidate-pool/public promotion discussion.",
    ],
    forbiddenInThisPacket: [
      "whole home_appliance_tech_discovered approval",
      "runtime parser/catalog edits",
      "candidate-pool policy wiring",
      "public promotion",
      "Supabase/cron/lifecycle/package UI changes",
    ],
    conclusion: "home_appliance_vacuum_runtime_prep_completed_report_only_split_architecture",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "home-appliance-vacuum-runtime-prep-latest.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Home Appliance Vacuum Runtime Prep",
    "",
    `- generatedAt: ${generatedAt}`,
    "- category: home_appliance_tech_discovered",
    "- conclusion: home_appliance_vacuum_runtime_prep_completed_report_only_split_architecture",
    "- reportOnly: true",
    "- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false",
    "- productionDbMutation/directThirtyDayPlanEdit: false/false",
    "",
    "## Metrics",
    "",
    `- model-ready rows: ${report.metrics.modelReadyRows}`,
    `- stick/handheld rows: ${report.metrics.stickOrHandheldRows}`,
    `- robot vacuum rows: ${report.metrics.robotVacuumRows}`,
    `- generic vacuum rows: ${report.metrics.genericVacuumRows}`,
    `- exclusion-candidate-only rows: ${report.metrics.exclusionCandidateOnlyRows}`,
    `- inherited logistics risk count: ${report.metrics.inheritedLogisticsRiskCount}`,
    `- row-level logistics examples prepared: ${report.metrics.rowLevelLogisticsExamplesPrepared}`,
    `- runtime-approved rows: ${report.runtimeApprovedRows}`,
    `- candidate-positive-only rows: ${report.candidatePositiveOnlyRows}`,
    "",
    "## Subtype Split",
    "",
    "| subtype | lane | sample evidence | key signals | hold signals |",
    "| --- | --- | --- | --- | --- |",
    ...subtypePrepRows.map((row) => [
      row.subtype,
      row.lane,
      row.sampleEvidence.join(" / ").replace(/\|/g, "/"),
      row.keySignals.join(", ").replace(/\|/g, "/"),
      row.holdSignals.join(", ").replace(/\|/g, "/"),
    ].join(" | ")).map((line) => `| ${line} |`),
    "",
    "## Later Selected-Subset Review Candidates",
    "",
    "| key | subtype | count | stability | blockers |",
    "| --- | --- | ---: | --- | --- |",
    ...reviewCandidates.map((row) => `| ${row.key} | ${row.subtype} | ${row.sourceCount} | ${row.stability} | ${row.blockedBy.join("; ")} |`),
    "",
    "## Logistics / Shipping-Heavy Rows",
    "",
    "| pid | price | freeShipping | signals | title |",
    "| --- | ---: | --- | --- | --- |",
    ...logisticsRows.map((row) => `| ${row.pid} | ${row.price} | ${row.freeShipping ? "yes" : "no"} | ${row.signals.join(", ")} | ${row.title.replace(/\|/g, "/")} |`),
    "",
    "## Blocked Owner Decisions",
    "",
    ...markdownList(report.blockedOwnerDecisions),
    "",
    "## Do Not Do",
    "",
    ...markdownList(report.forbiddenInThisPacket),
  ].join("\n");

  await writeFile(path.join(reportsDir, "home-appliance-vacuum-runtime-prep-latest.md"), `${md}\n`);

  console.log("wrote reports/home-appliance-vacuum-runtime-prep-latest.json");
  console.log("wrote reports/home-appliance-vacuum-runtime-prep-latest.md");
  console.log(`home appliance vacuum runtime prep: subtype_rows=${subtypePrepRows.length}, review_candidates=${reviewCandidates.length}, logistics_rows=${logisticsRows.length}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
