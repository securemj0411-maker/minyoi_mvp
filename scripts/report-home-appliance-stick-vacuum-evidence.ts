import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type EvidenceSource = {
  label: string;
  url: string;
  evidenceType: "official_support" | "official_product" | "official_press" | "vendor_catalog";
  supports: string;
};

type SelectedRow = {
  pid: string;
  title: string;
  price: number;
  condition: string;
  brand: string;
  modelKey: string;
  listingEvidence: string[];
  sourceEvidence: EvidenceSource[];
  subtypeDecision: "stick_handheld_reference_only";
  candidatePosture: "evidence_backfilled_not_runtime_approved" | "manual_hold_until_owner_policy";
  logisticsFlags: string[];
  boundaryNotes: string[];
};

type BoundaryRow = {
  pid: string;
  title: string;
  boundaryClass: string;
  holdReason: string;
};

const reportsDir = path.join(process.cwd(), "reports");

const selectedRows: SelectedRow[] = [
  {
    pid: "407301139",
    title: "다이슨 V10 카본파이버 무선청소기(풀세트)",
    price: 230000,
    condition: "LIGHTLY_USED",
    brand: "dyson",
    modelKey: "dyson-cyclone-v10-carbon-fiber",
    listingEvidence: ["V10", "카본파이버", "무선청소기", "풀세트", "정품 스탠드", "브러쉬/액세서리 포함"],
    sourceEvidence: [
      {
        label: "Dyson Cyclone V10 cordless stick vacuum support",
        url: "https://www.dyson.com/support/vacuum-cleaners/cordless/v10/sv27",
        evidenceType: "official_support",
        supports: "Dyson maintains support/manual evidence for Cyclone V10 cordless stick vacuum.",
      },
      {
        label: "Dyson V10 cordless vacuum product family",
        url: "https://www.dyson.com/vacuum-cleaners/cordless/v10/shop-all",
        evidenceType: "official_product",
        supports: "Dyson product-family page establishes V10 as a cordless vacuum line.",
      },
    ],
    subtypeDecision: "stick_handheld_reference_only",
    candidatePosture: "evidence_backfilled_not_runtime_approved",
    logisticsFlags: ["local_test_preferred", "bulky_full_set_with_stand"],
    boundaryNotes: ["Full-set wording supports full-unit context, but accessory bundle contents must remain secondary axes."],
  },
  {
    pid: "407295219",
    title: "다이슨 V8무선 청소기 충전기 포함 판매",
    price: 130000,
    condition: "LIGHTLY_USED",
    brand: "dyson",
    modelKey: "dyson-v8",
    listingEvidence: ["V8", "무선청소기", "본체", "연장관", "헤드", "충전기", "거치대"],
    sourceEvidence: [
      {
        label: "Dyson V8 cordless vacuum product page",
        url: "https://www.dyson.com/vacuum-cleaners/cordless/v8",
        evidenceType: "official_product",
        supports: "Dyson product page establishes V8 as a cordless vacuum.",
      },
      {
        label: "Dyson cordless vacuum support index",
        url: "https://www.dyson.com/support/vacuum-cleaners/cordless",
        evidenceType: "official_support",
        supports: "Dyson support index includes V8 cordless vacuum support family.",
      },
    ],
    subtypeDecision: "stick_handheld_reference_only",
    candidatePosture: "evidence_backfilled_not_runtime_approved",
    logisticsFlags: ["local_pickup_preferred_by_seller", "battery_runtime_caveat"],
    boundaryNotes: ["Battery endurance caveat should stay a condition/logistics note, not model identity."],
  },
  {
    pid: "406109107",
    title: "다이슨v7청소기.본체.밧데리.틈새흡입봉",
    price: 65000,
    condition: "LIKE_NEW",
    brand: "dyson",
    modelKey: "dyson-v7",
    listingEvidence: ["V7", "청소기", "본체", "배터리", "틈새흡입봉"],
    sourceEvidence: [
      {
        label: "Dyson V7 cordless vacuum support",
        url: "https://www.dyson.com/support/vacuum-cleaners/cordless/v7",
        evidenceType: "official_support",
        supports: "Dyson support page establishes V7 cordless vacuum support family.",
      },
    ],
    subtypeDecision: "stick_handheld_reference_only",
    candidatePosture: "manual_hold_until_owner_policy",
    logisticsFlags: ["extra_fee_or_add_on", "charger_and_stand_additional_fee"],
    boundaryNotes: ["Charger/stand are add-ons, so this row should not become auto-ready without package/complete-set policy."],
  },
  {
    pid: "391310002",
    title: "[dyson] 다이슨 무선청소기 V6",
    price: 80000,
    condition: "HEAVILY_USED",
    brand: "dyson",
    modelKey: "dyson-v6",
    listingEvidence: ["V6", "무선청소기", "충전기", "호환 배터리"],
    sourceEvidence: [
      {
        label: "Dyson V6 cordless stick vacuum support",
        url: "https://www.dyson.com/support/vacuum-cleaners/cordless/v6/sv04",
        evidenceType: "official_support",
        supports: "Dyson support/manual page establishes V6 cordless stick vacuum.",
      },
    ],
    subtypeDecision: "stick_handheld_reference_only",
    candidatePosture: "manual_hold_until_owner_policy",
    logisticsFlags: ["heavily_used", "compatible_battery_caveat"],
    boundaryNotes: ["Compatible battery language is a condition/package risk and should prevent automatic candidate use."],
  },
  {
    pid: "390189944",
    title: "[LG] 코드제로 무선청소기 A9",
    price: 159000,
    condition: "HEAVILY_USED",
    brand: "lg",
    modelKey: "lg-codezero-a9-a978ia",
    listingEvidence: ["A978IA", "코드제로", "A9", "스탠드", "충전기", "브러시"],
    sourceEvidence: [
      {
        label: "LG release for CodeZero A9 A978IA/A978VA",
        url: "https://www.lg.co.kr/media/release/10018",
        evidenceType: "official_press",
        supports: "LG release names CodeZero A9 models A978IA and A978VA with powered mop head.",
      },
      {
        label: "LG CordZero A9 cordless stick vacuum product family",
        url: "https://www.lg.com/us/vacuum-cleaners/lg-a900bm-stick-vacuum",
        evidenceType: "official_product",
        supports: "LG product page establishes CordZero A9 as a cordless stick vacuum family.",
      },
    ],
    subtypeDecision: "stick_handheld_reference_only",
    candidatePosture: "evidence_backfilled_not_runtime_approved",
    logisticsFlags: ["heavily_used"],
    boundaryNotes: ["A978IA is stronger than generic A9, but exact Korean model variants need owner-approved normalization."],
  },
  {
    pid: "380591188",
    title: "[스마트 인버터 모터 새상품][LG] 코드제로 무선청소기 A9",
    price: 259000,
    condition: "LIGHTLY_USED",
    brand: "lg",
    modelKey: "lg-codezero-a9-s96kfbswh",
    listingEvidence: ["S96KFBSWH", "코드제로", "A9", "스탠드", "충전기", "브러시", "모터/필터/먼지통 교체"],
    sourceEvidence: [
      {
        label: "LG Korea support for S96KFBSWH1",
        url: "https://www.lge.co.kr/support/product-S96KFBSWH1",
        evidenceType: "official_support",
        supports: "LG support classifies S96KFBSWH1 under vacuum cleaner > cordless vacuum.",
      },
      {
        label: "SSG vendor catalog for LG S96KFBSWH",
        url: "https://www.ssg.com/item/itemView.ssg?itemId=1000022653471",
        evidenceType: "vendor_catalog",
        supports: "Vendor catalog confirms LG CodeZero A9 model number S96KFBSWH.",
      },
    ],
    subtypeDecision: "stick_handheld_reference_only",
    candidatePosture: "manual_hold_until_owner_policy",
    logisticsFlags: ["recent_service_parts_replaced", "battery_refill_caveat"],
    boundaryNotes: ["Replacement motor/filter/bin evidence is condition-heavy and needs pricing policy before comparable use."],
  },
  {
    pid: "371947057",
    title: "[LG] 코드제로 무선청소기 A9",
    price: 169000,
    condition: "LIGHTLY_USED",
    brand: "lg",
    modelKey: "lg-codezero-a9-a938so",
    listingEvidence: ["A938SO", "코드제로", "A9", "스탠드", "충전기", "브러시", "리필 배터리"],
    sourceEvidence: [
      {
        label: "LG CordZero A9 cordless stick vacuum product family",
        url: "https://www.lg.com/us/vacuum-cleaners/lg-a900bm-stick-vacuum",
        evidenceType: "official_product",
        supports: "LG product page establishes CordZero A9 as a cordless stick vacuum family.",
      },
    ],
    subtypeDecision: "stick_handheld_reference_only",
    candidatePosture: "manual_hold_until_owner_policy",
    logisticsFlags: ["battery_refill_caveat"],
    boundaryNotes: ["A938SO model token is useful, but exact official variant source remains weaker than A978IA/S96KFBSWH."],
  },
  {
    pid: "402326950",
    title: "[샤오미] 무선청소기 V10",
    price: 80000,
    condition: "LIGHTLY_USED",
    brand: "xiaomi",
    modelKey: "xiaomi-mi-vacuum-cleaner-g10-vvn3",
    listingEvidence: ["VVN3", "샤오미", "무선청소기", "V10", "충전기", "스탠드 제외"],
    sourceEvidence: [
      {
        label: "Xiaomi Korea Mi Vacuum Cleaner G10",
        url: "https://www.mi.com/kr/product/mi-vacuum-cleaner-g10/",
        evidenceType: "official_product",
        supports: "Xiaomi Korea product page establishes Mi Vacuum Cleaner G10 as handheld/stick vacuum with 2-in-1 vacuum/mop wording.",
      },
      {
        label: "Dreame VVN3 user manual",
        url: "https://mi-house.ru/asserts/instructions/2731/1/v10.pdf",
        evidenceType: "vendor_catalog",
        supports: "Manual evidence includes VVN3-EU-R02 for a cordless vacuum cleaner.",
      },
    ],
    subtypeDecision: "stick_handheld_reference_only",
    candidatePosture: "manual_hold_until_owner_policy",
    logisticsFlags: ["stand_excluded", "v10_g10_alias_ambiguity"],
    boundaryNotes: ["V10 title plus VVN3 description likely maps to Xiaomi/Dreame handheld vacuum, but alias policy is unresolved."],
  },
];

const boundaryRows: BoundaryRow[] = [
  {
    pid: "355094447",
    title: "(미사용 새상품) 클리엔 로봇청소기 r9 화이트 청소기",
    boundaryClass: "robot_vacuum_separate_axis",
    holdReason: "Robot vacuum must stay outside stick/handheld comparable keys and needs dock/base-station package policy.",
  },
  {
    pid: "405152030",
    title: "NARWAL FREO 나르왈 프레오 로봇청소기(배터리새것)",
    boundaryClass: "robot_vacuum_separate_axis",
    holdReason: "Robot vacuum plus battery-new condition; not a stick/handheld vacuum row.",
  },
  {
    pid: "291363501",
    title: "아이로봇 룸바 i 시리즈 클린베이스(자동먼지통)",
    boundaryClass: "dock_base_station_only",
    holdReason: "Clean Base/auto-empty station only; not vacuum full unit.",
  },
  {
    pid: "387903870",
    title: "퀸메이드 침구청소기",
    boundaryClass: "bedding_cleaner_hold",
    holdReason: "Bedding cleaner subtype remains separate from stick/handheld vacuum MVP lane.",
  },
  {
    pid: "279832779",
    title: "비스포크제트 물걸레브러쉬 거의 새제품급 다회용걸레 미개봉새제품 4장 포함",
    boundaryClass: "accessory_consumable_hold",
    holdReason: "Mop brush/cloth bundle is accessory/consumable, not a Bespoke Jet vacuum unit.",
  },
  {
    pid: "307627278",
    title: "다이슨 청소기 충전기 어댑터 205720-02",
    boundaryClass: "accessory_parts_hold",
    holdReason: "Charger adapter only; hard accessory exclusion.",
  },
];

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function countBy(values: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const manualHoldRows = selectedRows.filter((row) => row.candidatePosture === "manual_hold_until_owner_policy");
  const logisticsRows = selectedRows.filter((row) => row.logisticsFlags.length > 0);
  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "home_appliance_tech_discovered",
    assignedPrefix: "home-appliance-stick-vacuum",
    conclusion: "stick_handheld_vacuum_evidence_backfilled_report_only_not_runtime_approved",
    sourceReports: [
      "reports/home-appliance-vacuum-runtime-prep-latest.md",
      "reports/home-appliance-vacuum-subtype-fixture-packet-latest.md",
      "reports/home-appliance-no-mutation-runtime-dry-run-latest.md",
      "category-intelligence/home_appliance_tech_discovered/samples.json",
    ],
    metrics: {
      selectedRows: selectedRows.length,
      evidenceBackfilledRows: selectedRows.length,
      officialOrVendorEvidenceRows: selectedRows.filter((row) => row.sourceEvidence.length > 0).length,
      evidenceSources: selectedRows.reduce((sum, row) => sum + row.sourceEvidence.length, 0),
      manualHoldUntilOwnerPolicyRows: manualHoldRows.length,
      logisticsFlaggedRows: logisticsRows.length,
      boundaryHoldRows: boundaryRows.length,
      runtimeApprovedRows: 0,
      candidatePositiveOnlyRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
      brandCounts: countBy(selectedRows.map((row) => row.brand)),
    },
    selectedRows,
    boundaryRows,
    implementationPrepOnlyRules: [
      "Only stick/handheld exact-model rows are evidence-backed here.",
      "Robot vacuum, bedding cleaner, wet/dry cleaner, dock/base-station, and accessory/consumable rows remain separate holds.",
      "Charger, stand, replacement battery, motor replacement, or excluded stand wording must remain condition/package/logistics signals.",
      "No selected row is runtime-approved, public-ready, or candidate-pool-ready in this packet.",
    ],
    blockedOwnerDecisions: [
      "Approve or reject stick/handheld vacuum as the first narrow home-appliance runtime subset.",
      "Define whether complete-set requirements need charger, stand, battery, main head, or body-only eligibility.",
      "Define logistics treatment for bulky full sets, local test/pickup preference, and extra-fee accessories.",
      "Decide whether LG CodeZero A9 Korean variant tokens normalize under one A9 family or remain exact variant keys.",
      "Decide whether Xiaomi V10/G10/VVN3 aliases are eligible or must wait for a dedicated alias policy.",
      "Define robot vacuum dock/base-station/package axis before robot vacuum rows can be considered.",
    ],
    nextMainAgentAction: "If selected later, implement a no-mutation parser contract for only the evidence-backed stick/handheld subset; keep manual-hold logistics and accessory boundaries excluded.",
    doNotDo: [
      "Do not promote home_appliance_tech_discovered as a whole category.",
      "Do not edit runtime parser/catalog wiring from this packet.",
      "Do not wire candidate pool/public policy.",
      "Do not mutate Supabase, cron, lifecycle, pack UI, or source catalogs.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "home-appliance-stick-vacuum-evidence-latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  const selectedTable = [
    "| pid | modelKey | posture | logisticsFlags | title |",
    "| --- | --- | --- | --- | --- |",
    ...selectedRows.map((row) =>
      `| ${row.pid} | ${row.modelKey} | ${row.candidatePosture} | ${row.logisticsFlags.join(", ") || "-"} | ${escapeCell(row.title)} |`,
    ),
  ].join("\n");

  const sourceTable = [
    "| modelKey | source | type | supports |",
    "| --- | --- | --- | --- |",
    ...selectedRows.flatMap((row) =>
      row.sourceEvidence.map(
        (source) =>
          `| ${row.modelKey} | [${escapeCell(source.label)}](${source.url}) | ${source.evidenceType} | ${escapeCell(source.supports)} |`,
      ),
    ),
  ].join("\n");

  const boundaryTable = [
    "| pid | boundaryClass | holdReason | title |",
    "| --- | --- | --- | --- |",
    ...boundaryRows.map((row) => `| ${row.pid} | ${row.boundaryClass} | ${escapeCell(row.holdReason)} | ${escapeCell(row.title)} |`),
  ].join("\n");

  const md = [
    "# Home Appliance Stick/Handheld Vacuum Evidence",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- category: ${report.category}`,
    `- conclusion: ${report.conclusion}`,
    "- reportOnly: true",
    "- runtimeCatalogApply/publicPromotion/candidatePoolPolicyWiring: false/false/false",
    "- productionDbMutation/directThirtyDayPlanEdit: false/false",
    "",
    "## Metrics",
    "",
    `- selectedRows: ${report.metrics.selectedRows}`,
    `- officialOrVendorEvidenceRows: ${report.metrics.officialOrVendorEvidenceRows}`,
    `- evidenceSources: ${report.metrics.evidenceSources}`,
    `- manualHoldUntilOwnerPolicyRows: ${report.metrics.manualHoldUntilOwnerPolicyRows}`,
    `- logisticsFlaggedRows: ${report.metrics.logisticsFlaggedRows}`,
    `- boundaryHoldRows: ${report.metrics.boundaryHoldRows}`,
    "- runtimeApprovedRows: 0",
    "- candidatePositiveOnlyRows: 0",
    "",
    "## Selected Stick/Handheld Rows",
    "",
    selectedTable,
    "",
    "## Source Evidence",
    "",
    sourceTable,
    "",
    "## Boundary Holds",
    "",
    boundaryTable,
    "",
    "## Implementation-Prep Rules",
    "",
    ...report.implementationPrepOnlyRules.map((line) => `- ${line}`),
    "",
    "## Blocked Owner Decisions",
    "",
    ...report.blockedOwnerDecisions.map((line) => `- ${line}`),
    "",
    "## Next Main-Agent Action",
    "",
    `- ${report.nextMainAgentAction}`,
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((line) => `- ${line}`),
    "",
  ].join("\n");

  await writeFile(path.join(reportsDir, "home-appliance-stick-vacuum-evidence-latest.md"), md);

  console.log(
    JSON.stringify(
      {
        conclusion: report.conclusion,
        selectedRows: report.metrics.selectedRows,
        manualHoldUntilOwnerPolicyRows: report.metrics.manualHoldUntilOwnerPolicyRows,
        logisticsFlaggedRows: report.metrics.logisticsFlaggedRows,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
