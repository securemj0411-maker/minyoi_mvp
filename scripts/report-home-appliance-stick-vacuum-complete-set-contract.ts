import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type EvidenceRow = {
  pid: string;
  title: string;
  price: number;
  condition: string;
  brand: string;
  modelKey: string;
  listingEvidence: string[];
  candidatePosture: string;
  logisticsFlags: string[];
};

type EvidenceReport = {
  selectedRows: EvidenceRow[];
};

type NormalizedSample = {
  pid: string;
  title: string;
  price: number;
  condition: string;
  description: string;
  freeShipping: boolean;
};

type ContractDecision =
  | "candidate_positive_contract_only"
  | "manual_hold_body_or_incomplete_set"
  | "manual_hold_condition_or_alias"
  | "negative_hold_accessory_only"
  | "negative_hold_robot_vacuum"
  | "negative_hold_bedding_cleaner"
  | "negative_hold_wet_dry_cleaner"
  | "negative_hold_dock_base_station_only"
  | "negative_hold_generic_or_brand_only";

type ContractRow = {
  caseId: string;
  pid: string;
  title: string;
  price: number;
  expectedDecision: ContractDecision;
  expectedSubtype: string;
  expectedModelKey: string | null;
  expectedComparableKey: string | null;
  componentClass: string;
  requiredSignalsPresent: string[];
  exclusionSignals: string[];
  reason: string;
};

const reportsDir = path.join(process.cwd(), "reports");
const samplesPath = path.join(
  process.cwd(),
  "category-intelligence",
  "home_appliance_tech_discovered",
  "normalized_samples.json",
);
const evidencePath = path.join(reportsDir, "home-appliance-stick-vacuum-evidence-latest.json");

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function getSample(samples: NormalizedSample[], pid: string): NormalizedSample {
  const sample = samples.find((row) => String(row.pid) === pid);
  if (!sample) {
    throw new Error(`Missing normalized sample for pid ${pid}`);
  }
  return sample;
}

function compactSignals(signals: string[]): string[] {
  return [...new Set(signals)].filter(Boolean);
}

function sampleText(sample: NormalizedSample): string {
  return `${sample.title}\n${sample.description}`.toLowerCase();
}

function hasAny(text: string, tokens: string[]): boolean {
  return tokens.some((token) => text.includes(token.toLowerCase()));
}

function detectSignals(sample: NormalizedSample): { present: string[]; exclusion: string[] } {
  const text = sampleText(sample);
  const present = compactSignals([
    hasAny(text, ["본체", "청소기", "무선청소기"]) ? "vacuum_body_or_full_unit" : "",
    hasAny(text, ["충전기", "어댑터"]) ? "charger" : "",
    hasAny(text, ["헤드", "브러시", "브러쉬", "롤러"]) ? "main_head_or_cleaning_brush" : "",
    hasAny(text, ["풀세트", "모두 포함", "구성품 다 있음", "구성품"]) ? "set_or_components_wording" : "",
    hasAny(text, ["스탠드", "거치대"]) ? "stand_or_holder" : "",
    hasAny(text, ["배터리", "밧데리"]) ? "battery" : "",
  ]);

  const exclusion = compactSignals([
    hasAny(text, ["로봇청소기"]) ? "robot_vacuum" : "",
    hasAny(text, ["침구청소기", "침구 청소기"]) ? "bedding_cleaner" : "",
    hasAny(text, ["물걸레", "물탱크", "습식", "건식"]) ? "wet_dry_or_mop_axis" : "",
    hasAny(text, ["클린베이스", "자동먼지통", "스테이션"]) ? "dock_base_station_only" : "",
    hasAny(text, ["충전어댑터", "충전기 어댑터", "배터리", "밧데리", "물걸레브러쉬", "키트", "거치대 크래들 홀더", "홀더만", "베이스만"]) ? "accessory_or_part_only_risk" : "",
    hasAny(text, ["추가됩니다", "추가 됩니다", "추가"]) ? "extra_fee_add_on" : "",
    hasAny(text, ["스탠드 제외", "스탠드제외"]) ? "stand_excluded" : "",
    hasAny(text, ["호환 배터리", "리필 배터리", "새거교환", "새것으로 교환"]) ? "battery_replacement_caveat" : "",
    hasAny(text, ["브랜드만", "코드제로 무선청소기"]) && !hasAny(text, ["a9", "a978ia", "s96kfbswh", "a938so"]) ? "brand_only_or_missing_exact_model" : "",
  ]);

  return { present, exclusion };
}

function rowFromSample(
  caseId: string,
  sample: NormalizedSample,
  expectedDecision: ContractDecision,
  expectedSubtype: string,
  componentClass: string,
  reason: string,
  expectedModelKey: string | null = null,
): ContractRow {
  const signals = detectSignals(sample);
  const comparableKey =
    expectedDecision === "candidate_positive_contract_only" && expectedModelKey
      ? `stick_vacuum|${expectedModelKey}|complete_set`
      : null;

  return {
    caseId,
    pid: String(sample.pid),
    title: sample.title,
    price: sample.price,
    expectedDecision,
    expectedSubtype,
    expectedModelKey,
    expectedComparableKey: comparableKey,
    componentClass,
    requiredSignalsPresent: signals.present,
    exclusionSignals: signals.exclusion,
    reason,
  };
}

function mdCell(value: string | null): string {
  return (value ?? "null").replaceAll("|", "\\|");
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const evidence = await readJson<EvidenceReport>(evidencePath);
  const samples = await readJson<NormalizedSample[]>(samplesPath);
  const evidenceByPid = new Map(evidence.selectedRows.map((row) => [row.pid, row]));

  const rows: ContractRow[] = [
    rowFromSample(
      "VACUUM-COMPLETE-POS-01",
      getSample(samples, "407301139"),
      "candidate_positive_contract_only",
      "stick_handheld_vacuum",
      "full_set_with_charger_and_main_head",
      "Dyson V10 exact model with full-set wording, charger/stand/accessory bundle context, and no accessory-only subtype pressure.",
      evidenceByPid.get("407301139")?.modelKey ?? "dyson-cyclone-v10-carbon-fiber",
    ),
    rowFromSample(
      "VACUUM-COMPLETE-POS-02",
      getSample(samples, "407295219"),
      "candidate_positive_contract_only",
      "stick_handheld_vacuum",
      "full_set_with_charger_and_main_head",
      "Dyson V8 exact model with body, extension tube, head, charger, and holder included; battery runtime caveat remains condition metadata.",
      evidenceByPid.get("407295219")?.modelKey ?? "dyson-v8",
    ),
    rowFromSample(
      "VACUUM-COMPLETE-HOLD-01",
      getSample(samples, "406109107"),
      "manual_hold_body_or_incomplete_set",
      "stick_handheld_vacuum",
      "body_battery_crevice_tool_charger_stand_extra_fee",
      "Charger and stand require an extra fee, so the base row is body/incomplete-set and must not pass complete-set policy.",
      evidenceByPid.get("406109107")?.modelKey ?? "dyson-v7",
    ),
    rowFromSample(
      "VACUUM-COMPLETE-HOLD-02",
      getSample(samples, "391310002"),
      "manual_hold_body_or_incomplete_set",
      "stick_handheld_vacuum",
      "body_charger_stand_excluded",
      "Dyson V6 has charger but explicitly excludes stand and lacks clear main-head/full-set evidence.",
      evidenceByPid.get("391310002")?.modelKey ?? "dyson-v6",
    ),
    rowFromSample(
      "VACUUM-COMPLETE-HOLD-03",
      getSample(samples, "390189944"),
      "manual_hold_condition_or_alias",
      "stick_handheld_vacuum",
      "lg_a9_full_set_variant_hold",
      "LG A9 A978IA has stand/charger/brush signals, but LG A9 variant normalization and heavy-use policy need owner approval before positive use.",
      evidenceByPid.get("390189944")?.modelKey ?? "lg-codezero-a9-a978ia",
    ),
    rowFromSample(
      "VACUUM-COMPLETE-HOLD-04",
      getSample(samples, "380591188"),
      "manual_hold_condition_or_alias",
      "stick_handheld_vacuum",
      "lg_a9_full_set_variant_service_parts_hold",
      "LG A9 S96KFBSWH has full-set components but service-part replacement and refill-battery caveats are unresolved condition policy.",
      evidenceByPid.get("380591188")?.modelKey ?? "lg-codezero-a9-s96kfbswh",
    ),
    rowFromSample(
      "VACUUM-COMPLETE-HOLD-05",
      getSample(samples, "371947057"),
      "manual_hold_condition_or_alias",
      "stick_handheld_vacuum",
      "lg_a9_full_set_variant_refill_battery_hold",
      "LG A9 A938SO has charger/stand/brush signals but refill-battery and A9 alias policy remain owner-blocked.",
      evidenceByPid.get("371947057")?.modelKey ?? "lg-codezero-a9-a938so",
    ),
    rowFromSample(
      "VACUUM-COMPLETE-HOLD-06",
      getSample(samples, "402326950"),
      "manual_hold_body_or_incomplete_set",
      "stick_handheld_vacuum",
      "xiaomi_vvn3_charger_stand_excluded",
      "Xiaomi VVN3/V10/G10 alias must not be normalized into runtime, and stand is excluded.",
      evidenceByPid.get("402326950")?.modelKey ?? "xiaomi-mi-vacuum-cleaner-g10-vvn3",
    ),
    rowFromSample(
      "VACUUM-COMPLETE-NEG-01",
      getSample(samples, "307627278"),
      "negative_hold_accessory_only",
      "accessory_parts_consumable",
      "charger_adapter_only",
      "Charger adapter only; no vacuum body or complete-set context.",
    ),
    rowFromSample(
      "VACUUM-COMPLETE-NEG-02",
      getSample(samples, "311633684"),
      "negative_hold_accessory_only",
      "accessory_parts_consumable",
      "battery_only",
      "Battery-only row for Samsung Bespoke Jet; accessory-only rows must never create complete-set comparable keys.",
    ),
    rowFromSample(
      "VACUUM-COMPLETE-NEG-03",
      getSample(samples, "279832779"),
      "negative_hold_accessory_only",
      "accessory_parts_consumable",
      "mop_brush_consumable_bundle",
      "Mop brush/cloth bundle is accessory/consumable material, not a vacuum full unit.",
    ),
    rowFromSample(
      "VACUUM-COMPLETE-NEG-04",
      getSample(samples, "261708593"),
      "negative_hold_accessory_only",
      "accessory_parts_consumable",
      "stand_holder_only",
      "Holder-only wording explicitly excludes the vacuum and cradle; hard accessory hold.",
    ),
    rowFromSample(
      "VACUUM-COMPLETE-NEG-05",
      getSample(samples, "291363501"),
      "negative_hold_dock_base_station_only",
      "dock_base_station_only",
      "clean_base_only",
      "Roomba i-series Clean Base only; dock/base-station package axis is separate from vacuum complete-set policy.",
    ),
    rowFromSample(
      "VACUUM-COMPLETE-NEG-06",
      getSample(samples, "355094447"),
      "negative_hold_robot_vacuum",
      "robot_vacuum",
      "robot_vacuum_full_unit_out_of_lane",
      "Robot vacuum with all components is still outside the stick/handheld complete-set lane and must not be approved here.",
    ),
    rowFromSample(
      "VACUUM-COMPLETE-NEG-07",
      getSample(samples, "405152030"),
      "negative_hold_robot_vacuum",
      "robot_vacuum",
      "robot_vacuum_battery_caveat",
      "Narwal Freo robot vacuum plus battery-new condition belongs to robot policy, not stick/handheld complete-set policy.",
    ),
    rowFromSample(
      "VACUUM-COMPLETE-NEG-08",
      getSample(samples, "387903870"),
      "negative_hold_bedding_cleaner",
      "bedding_cleaner",
      "bedding_cleaner_full_unit_out_of_lane",
      "Bedding cleaner is vacuum-adjacent but not comparable to stick/handheld vacuum rows.",
    ),
    rowFromSample(
      "VACUUM-COMPLETE-NEG-09",
      getSample(samples, "228726143"),
      "negative_hold_wet_dry_cleaner",
      "wet_dry_cleaner",
      "mop_cleaner_out_of_lane",
      "Wet/dry or mop cleaner subtype is separate from stick/handheld vacuum complete-set policy.",
    ),
    rowFromSample(
      "VACUUM-COMPLETE-NEG-10",
      getSample(samples, "406587044"),
      "negative_hold_generic_or_brand_only",
      "stick_handheld_vacuum_generic",
      "brand_only_battery_discharge_hold",
      "LG CodeZero brand/family-only wording without exact model and with battery-discharge caveat is not complete-set eligible.",
    ),
  ];

  const metrics = {
    rows: rows.length,
    candidatePositiveContractOnlyRows: rows.filter((row) => row.expectedDecision === "candidate_positive_contract_only").length,
    manualHoldRows: rows.filter((row) => row.expectedDecision.startsWith("manual_hold")).length,
    negativeHoldRows: rows.filter((row) => row.expectedDecision.startsWith("negative_hold")).length,
    fullSetWithChargerAndMainHeadRows: rows.filter((row) => row.componentClass === "full_set_with_charger_and_main_head").length,
    bodyOnlyOrIncompleteSetRows: rows.filter((row) => row.expectedDecision === "manual_hold_body_or_incomplete_set").length,
    accessoryOnlyRows: rows.filter((row) => row.expectedDecision === "negative_hold_accessory_only").length,
    robotVacuumRows: rows.filter((row) => row.expectedDecision === "negative_hold_robot_vacuum").length,
    beddingCleanerRows: rows.filter((row) => row.expectedDecision === "negative_hold_bedding_cleaner").length,
    wetDryCleanerRows: rows.filter((row) => row.expectedDecision === "negative_hold_wet_dry_cleaner").length,
    dockBaseStationOnlyRows: rows.filter((row) => row.expectedDecision === "negative_hold_dock_base_station_only").length,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolWiringRows: 0,
  };

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "home_appliance_tech_discovered",
    lane: "stick_handheld_vacuum_complete_set_contract",
    conclusion: "complete_set_policy_draft_ready_report_only_owner_blocked",
    inputFiles: [
      "reports/home-appliance-stick-vacuum-evidence-latest.md/json",
      "reports/home-appliance-vacuum-runtime-prep-latest.md/json",
      "reports/home-appliance-vacuum-subtype-boundary-evidence-latest.md/json",
      "category-intelligence/home_appliance_tech_discovered/normalized_samples.json",
    ],
    policyDraft: {
      positiveMinimum: [
        "stick/handheld vacuum exact model evidence",
        "vacuum body/full-unit context",
        "charger included in the base sale",
        "main cleaning head/brush included in the base sale",
        "no extra-fee/add-on requirement for charger, stand, battery, or head",
        "no robot, bedding, wet/dry, dock/base-station-only, or accessory-only subtype signal",
      ],
      optionalSignals: ["stand/holder included", "extra tools/accessories included", "battery runtime note as condition metadata only"],
      holdSignals: [
        "body-only or incomplete component set",
        "charger/stand/head/battery offered for extra fee",
        "replacement/refill/compatible battery caveat",
        "brand/family-only title without exact model",
        "LG A9 family/variant normalization request",
        "Xiaomi V10/G10/VVN3 alias request",
      ],
      negativeSignals: [
        "charger/adapter/battery/head/brush/cloth/filter/stand/holder accessory-only",
        "robot vacuum",
        "bedding cleaner",
        "wet/dry or mop cleaner",
        "dock/base-station/Clean Base only",
      ],
    },
    metrics,
    rows,
    blockedOwnerDecisions: [
      "Approve whether Dyson V10/V8 complete-set rows may become the first stick/handheld positive fixtures after no-mutation executor review.",
      "Decide if LG CodeZero A9 exact Korean variants can ever share an A9 family key; this packet intentionally does not normalize LG A9 into runtime.",
      "Decide whether compatible/replacement/refill battery caveats are hard holds or condition metadata for complete-set rows.",
      "Decide whether stand is optional when charger plus main head are present, or required for complete-set eligibility.",
      "Create a separate robot vacuum policy before approving robot full units or dock/base-station packages.",
      "Decide whether bedding cleaner and wet/dry/mop cleaner are future separate categories or permanent MVP exclusions.",
      "Decide logistics handling for bulky full sets, local testing, local pickup, parcel risk, and extra-fee accessories.",
    ],
    nextAction: "Owner/main agent can approve a no-mutation executor using this contract; do not add runtime home-appliance category or normalize LG A9/Xiaomi aliases yet.",
    forbiddenInThisPacket: [
      "runtime home appliance category",
      "robot vacuum approval",
      "LG A9 runtime normalization",
      "Xiaomi V10/G10/VVN3 runtime normalization",
      "candidate-pool policy wiring",
      "public promotion",
      "Supabase, cron, lifecycle, pack UI, candidate pool, package/env, or 30-day plan edits",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "home-appliance-stick-vacuum-complete-set-contract-latest.json");
  const mdPath = path.join(reportsDir, "home-appliance-stick-vacuum-complete-set-contract-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Home Appliance Stick Vacuum Complete-Set Contract",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- category: ${report.category}`,
    `- lane: ${report.lane}`,
    `- conclusion: ${report.conclusion}`,
    "",
    "## Boundary",
    "",
    "- reportOnly: true",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    "- productionDbMutation: false",
    "- directThirtyDayPlanEdit: false",
    "",
    "## Metrics",
    "",
    `- rows: ${metrics.rows}`,
    `- candidatePositiveContractOnlyRows: ${metrics.candidatePositiveContractOnlyRows}`,
    `- manualHoldRows: ${metrics.manualHoldRows}`,
    `- negativeHoldRows: ${metrics.negativeHoldRows}`,
    `- fullSetWithChargerAndMainHeadRows: ${metrics.fullSetWithChargerAndMainHeadRows}`,
    `- bodyOnlyOrIncompleteSetRows: ${metrics.bodyOnlyOrIncompleteSetRows}`,
    `- accessoryOnlyRows: ${metrics.accessoryOnlyRows}`,
    `- robotVacuumRows: ${metrics.robotVacuumRows}`,
    `- beddingCleanerRows: ${metrics.beddingCleanerRows}`,
    `- wetDryCleanerRows: ${metrics.wetDryCleanerRows}`,
    `- dockBaseStationOnlyRows: ${metrics.dockBaseStationOnlyRows}`,
    `- runtimeApprovedRows: ${metrics.runtimeApprovedRows}`,
    "",
    "## Complete-Set Policy Draft",
    "",
    "Positive rows require exact stick/handheld vacuum identity plus body/full-unit context, charger included in the base sale, and a main cleaning head or brush included in the base sale. Stand/holder and extra tools are useful package metadata but stay secondary unless the owner decides stand is mandatory.",
    "",
    "Rows must hold when charger, stand, battery, or head are extra-fee add-ons; when the row is body-only/incomplete; when battery replacement/refill/compatible wording changes condition risk; or when the title is brand/family-only without exact model evidence.",
    "",
    "Rows must be negative holds when they are accessory-only, robot vacuum, bedding cleaner, wet/dry or mop cleaner, or dock/base-station only.",
    "",
    "## Rows",
    "",
    "| caseId | expectedDecision | componentClass | expectedModelKey | expectedComparableKey | title |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${mdCell(row.caseId)} | ${mdCell(row.expectedDecision)} | ${mdCell(row.componentClass)} | ${mdCell(row.expectedModelKey)} | ${mdCell(row.expectedComparableKey)} | ${mdCell(row.title)} |`,
    ),
    "",
    "## Blocked Owner Decisions",
    "",
    ...report.blockedOwnerDecisions.map((decision) => `- ${decision}`),
    "",
    "## Next Action",
    "",
    `- ${report.nextAction}`,
    "",
    "## Do Not Do",
    "",
    ...report.forbiddenInThisPacket.map((item) => `- ${item}`),
    "",
  ].join("\n");

  await writeFile(mdPath, `${md}\n`);

  console.log(
    JSON.stringify(
      {
        conclusion: report.conclusion,
        rows: metrics.rows,
        candidatePositiveContractOnlyRows: metrics.candidatePositiveContractOnlyRows,
        manualHoldRows: metrics.manualHoldRows,
        negativeHoldRows: metrics.negativeHoldRows,
        jsonPath,
        mdPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
