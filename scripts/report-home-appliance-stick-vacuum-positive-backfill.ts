import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string;
  name?: string;
  title?: string;
  description?: string;
  price?: number;
  url?: string;
  source?: string;
};

type Decision = "candidate_positive_contract_only" | "manual_hold" | "negative_hold";

type ReviewRow = {
  caseId: string;
  sourcePid: string | null;
  sourcePath: string;
  sourceUrl: string | null;
  title: string;
  price: number | null;
  decision: Decision;
  modelFamily: string | null;
  modelKey: string | null;
  comparableKey: string | null;
  familyGroup: string | null;
  titleExactModelVisible: boolean;
  completeSetSignal: "title_complete_set" | "description_complete_set" | "missing_complete_set";
  componentEvidence: string[];
  holdClass: string | null;
  reason: string;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePoolReady: false;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const samplesPath = path.join(appDir, "category-intelligence", "home_appliance_tech_discovered", "normalized_samples.json");

const reviewPids = [
  "407301139",
  "407295219",
  "406490798",
  "406109107",
  "407312849",
  "407312522",
  "390189944",
  "380591188",
  "371947057",
  "402326950",
  "400109768",
  "405909046",
  "396037462",
  "403050706",
  "406207738",
  "403164662",
  "311633684",
  "279832779",
  "261708593",
  "250680090",
  "307627278",
  "232088519",
  "215723823",
  "407284002",
  "406839226",
  "407283412",
  "407282925",
  "403326422",
  "346239386",
  "355094447",
  "405152030",
  "406210679",
  "406210472",
  "384427956",
  "382932885",
  "407289960",
  "387903870",
  "385209987",
  "404984806",
  "407297623",
  "390953986",
  "407280193",
  "395028715",
  "228967044",
  "228726143",
  "407290496",
  "407290399",
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^0-9a-z가-힣+/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string): string {
  return normalizeText(value).replace(/\s+/g, "");
}

function markdownEscape(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function titleFor(sample: Sample): string {
  return sample.title ?? sample.name ?? "";
}

function inferModel(title: string, description: string): Pick<ReviewRow, "modelFamily" | "modelKey" | "familyGroup" | "titleExactModelVisible"> {
  const titleCompact = compact(title);
  const allCompact = compact(`${title}\n${description}`);

  const candidates: Array<{
    titlePattern: RegExp;
    allPattern: RegExp;
    modelFamily: string;
    modelKey: string;
    familyGroup: string;
  }> = [
    {
      titlePattern: /(?:다이슨|dyson).{0,12}v10|v10.{0,12}(?:다이슨|dyson)|싸이클론v10|cyclonev10|카본파이버/,
      allPattern: /(?:다이슨|dyson).{0,12}v10|v10.{0,12}(?:다이슨|dyson)|싸이클론v10|cyclonev10|카본파이버/,
      modelFamily: "Dyson V10",
      modelKey: "dyson-cyclone-v10-carbon-fiber",
      familyGroup: "dyson_v_series",
    },
    {
      titlePattern: /(?:다이슨|dyson).{0,12}v8|v8.{0,12}(?:다이슨|dyson)/,
      allPattern: /(?:다이슨|dyson).{0,12}v8|v8.{0,12}(?:다이슨|dyson)/,
      modelFamily: "Dyson V8",
      modelKey: "dyson-v8",
      familyGroup: "dyson_v_series",
    },
    {
      titlePattern: /(?:다이슨|dyson).{0,12}v7|v7.{0,12}(?:다이슨|dyson)/,
      allPattern: /(?:다이슨|dyson).{0,12}v7|v7.{0,12}(?:다이슨|dyson)/,
      modelFamily: "Dyson V7",
      modelKey: "dyson-v7",
      familyGroup: "dyson_v_series",
    },
    {
      titlePattern: /(?:다이슨|dyson).{0,12}v6|v6.{0,12}(?:다이슨|dyson)/,
      allPattern: /(?:다이슨|dyson).{0,12}v6|v6.{0,12}(?:다이슨|dyson)/,
      modelFamily: "Dyson V6",
      modelKey: "dyson-v6",
      familyGroup: "dyson_v_series",
    },
    {
      titlePattern: /다이슨|dyson/,
      allPattern: /다이슨|dyson/,
      modelFamily: "Dyson V-series",
      modelKey: "dyson-unknown",
      familyGroup: "dyson_v_series",
    },
    {
      titlePattern: /(?:lg|엘지|코드제로|codezero).{0,20}a9|a9/,
      allPattern: /(?:lg|엘지|코드제로|codezero).{0,20}a9|a9/,
      modelFamily: "LG CodeZero A9/A9S",
      modelKey: "lg-codezero-a9",
      familyGroup: "lg_codezero",
    },
    {
      titlePattern: /(?:삼성|samsung).{0,16}(?:비스포크)?제트|비스포크제트|bespokejet/,
      allPattern: /(?:삼성|samsung).{0,16}(?:비스포크)?제트|비스포크제트|bespokejet/,
      modelFamily: "Samsung Bespoke Jet",
      modelKey: "samsung-bespoke-jet",
      familyGroup: "samsung_bespoke_jet",
    },
    {
      titlePattern: /샤오미.{0,12}v10|xiaomi.{0,12}v10|vvn3|g10/,
      allPattern: /샤오미.{0,12}v10|xiaomi.{0,12}v10|vvn3|g10/,
      modelFamily: "Xiaomi V10/G10/VVN3",
      modelKey: "xiaomi-mi-vacuum-cleaner-g10-vvn3",
      familyGroup: "xiaomi_roborock",
    },
    {
      titlePattern: /(?:로보락|roborock).{0,8}[hs][0-9]/,
      allPattern: /(?:로보락|roborock).{0,8}[hs][0-9]/,
      modelFamily: "Roborock",
      modelKey: "roborock-vacuum-family",
      familyGroup: "xiaomi_roborock",
    },
    {
      titlePattern: /wellq6|well\s*q6/,
      allPattern: /wellq6|well\s*q6/,
      modelFamily: "Electrolux Well Q6",
      modelKey: "electrolux-well-q6",
      familyGroup: "electrolux",
    },
    {
      titlePattern: /에르고라피도|ergorapido|베드프로|bedpro/,
      allPattern: /에르고라피도|ergorapido|베드프로|bedpro/,
      modelFamily: "Electrolux Ergorapido BedPro",
      modelKey: "electrolux-ergorapido-bedpro",
      familyGroup: "electrolux",
    },
    {
      titlePattern: /홈리아|homelia|더스트제로|dustzero|220bl/,
      allPattern: /홈리아|homelia|더스트제로|dustzero|220bl/,
      modelFamily: "Homelia Dust Zero 220BL",
      modelKey: "homelia-dust-zero-220bl",
      familyGroup: "other_stick_vacuum",
    },
    {
      titlePattern: /칼만|kalman|dk-?4012|에어플렉스/,
      allPattern: /칼만|kalman|dk-?4012|에어플렉스/,
      modelFamily: "Kalman Air Flex DK-4012",
      modelKey: "kalman-air-flex-dk-4012",
      familyGroup: "other_stick_vacuum",
    },
    {
      titlePattern: /클리벤|4in1/,
      allPattern: /클리벤|4in1/,
      modelFamily: "Klieben 4-in-1",
      modelKey: "klieben-4in1",
      familyGroup: "other_stick_vacuum",
    },
  ];

  const exact = candidates.find((candidate) => candidate.titlePattern.test(titleCompact));
  const any = exact ?? candidates.find((candidate) => candidate.allPattern.test(allCompact));
  if (!any) {
    return {
      modelFamily: null,
      modelKey: null,
      familyGroup: null,
      titleExactModelVisible: false,
    };
  }

  return {
    modelFamily: any.modelFamily,
    modelKey: any.modelKey,
    familyGroup: any.familyGroup,
    titleExactModelVisible: Boolean(exact),
  };
}

function completeSetSignal(title: string, description: string): ReviewRow["completeSetSignal"] {
  const titleText = normalizeText(title);
  const allText = normalizeText(`${title}\n${description}`);
  if (/풀세트|풀\s*세트|풀구성|충전기\s*포함|충전기포함|모두\s*포함|전부\s*포함|포함\s*판매/.test(titleText)) {
    return "title_complete_set";
  }
  if (/풀세트|풀\s*세트|풀구성|구성품|충전기\s*포함|충전기포함|모두\s*포함|전부\s*포함|본체.{0,20}헤드.{0,20}충전기|스탠드.{0,12}충전기.{0,12}브러시/.test(allText)) {
    return "description_complete_set";
  }
  return "missing_complete_set";
}

function componentEvidence(title: string, description: string): string[] {
  const text = normalizeText(`${title}\n${description}`);
  const signals: Array<[RegExp, string]> = [
    [/본체|청소기/, "main_unit"],
    [/충전기|충전어댑터|어댑터|아답터/, "charger"],
    [/헤드|브러쉬|브러시|연장관|흡입봉|툴|tool/, "main_head_or_tool"],
    [/스탠드|거치대|크래들/, "stand_or_holder"],
    [/배터리|밧데리/, "battery"],
  ];
  return signals.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
}

function outOfLaneReason(title: string, description: string): string | null {
  const text = normalizeText(`${title}\n${description}`);
  if (/로봇\s*청소기|로봇청소기|룸바|프레오|브라바|xiaowa|물걸레\s*로봇|클린베이스|자동먼지통/.test(text)) return "out_of_lane_robot_vacuum";
  if (/침구\s*청소기|침구청소기|레이캅|딥슬립클링/.test(text)) return "out_of_lane_bedding_cleaner";
  if (/물걸레|스핀|듀얼스핀|욕실청소기|청소포|물탱크/.test(text)) return "out_of_lane_wet_dry_mop_or_consumable";
  return null;
}

function accessoryReason(title: string, description: string): string | null {
  const text = normalizeText(`${title}\n${description}`);
  const accessorySignal = /배터리|밧데리|충전기|어댑터|아답터|필터|브러쉬|브러시|헤드|거치대|크래들|홀더|키트|물걸레|청소포|툴|부속|부품|토탈케어/.test(text);
  const onlySignal = /단독|단품|만\s*입니다|만입니다|부품용|호환|미개봉|새제품|고장|모터고장|방전/.test(text);
  const titleLooksPart = /배터리|밧데리|충전기|어댑터|아답터|브러쉬|브러시|헤드|거치대|크래들|홀더|키트|물걸레|청소포|툴|부속|부품|토탈케어/.test(normalizeText(title));
  if (accessorySignal && (onlySignal || titleLooksPart) && !/청소기.{0,24}(풀세트|풀\s*세트|충전기\s*포함|포함\s*판매)/.test(text)) {
    return "accessory_or_part_only";
  }
  return null;
}

function caveatReason(title: string, description: string): string | null {
  const text = normalizeText(`${title}\n${description}`);
  if (/추가|별도|제외/.test(text)) return "extra_fee_or_excluded_component";
  if (/본체/.test(normalizeText(title)) && !/헤드|브러쉬|브러시|연장관/.test(normalizeText(title))) return "body_or_incomplete_title";
  if (/방전|부품용|고장|작동\s*안|상태모름|충전기없|충전기\s*없|파손/.test(text)) return "condition_or_incomplete_caveat";
  if (/리필\s*배터리|호환\s*배터리|밧데리\s*새거|배터리\s*새것/.test(text)) return "battery_condition_caveat";
  return null;
}

function classify(sample: Sample, index: number): ReviewRow {
  const title = titleFor(sample);
  const description = sample.description ?? "";
  const model = inferModel(title, description);
  const setSignal = completeSetSignal(title, description);
  const components = componentEvidence(title, description);
  const outOfLane = outOfLaneReason(title, description);
  const accessory = accessoryReason(title, description);
  const caveat = caveatReason(title, description);
  const base = {
    caseId: `VACUUM-BACKFILL-${String(index + 1).padStart(2, "0")}`,
    sourcePid: sample.pid ?? null,
    sourcePath: samplesPath,
    sourceUrl: sample.url ?? null,
    title,
    price: sample.price ?? null,
    modelFamily: model.modelFamily,
    modelKey: model.modelKey,
    familyGroup: model.familyGroup,
    titleExactModelVisible: model.titleExactModelVisible,
    completeSetSignal: setSignal,
    componentEvidence: components,
    runtimeApproved: false as const,
    publicPromotion: false as const,
    candidatePoolReady: false as const,
  };

  if (outOfLane || accessory) {
    const reason = outOfLane ?? accessory ?? "negative_hold";
    return {
      ...base,
      decision: "negative_hold",
      comparableKey: null,
      holdClass: reason,
      reason,
    };
  }

  const approvedDyson = model.modelKey === "dyson-cyclone-v10-carbon-fiber" || model.modelKey === "dyson-v8";
  const titleFullSet = /풀세트|풀\s*세트|풀구성/.test(normalizeText(title));
  const hasCoreComponents = components.includes("main_unit")
    && (components.includes("charger") || titleFullSet)
    && components.includes("main_head_or_tool");
  if (approvedDyson && model.titleExactModelVisible && setSignal === "title_complete_set" && hasCoreComponents && !caveat) {
    return {
      ...base,
      decision: "candidate_positive_contract_only",
      comparableKey: `stick_vacuum|${model.modelKey}|complete_set`,
      holdClass: null,
      reason: "title_visible_exact_model_and_title_complete_set_signal",
    };
  }

  let reason = "not_approved_complete_set_model";
  if (!model.modelKey) reason = "missing_exact_model";
  else if (!model.titleExactModelVisible) reason = "exact_model_not_title_visible";
  else if (setSignal !== "title_complete_set") reason = "title_lacks_complete_set_signal";
  else if (!hasCoreComponents) reason = "core_component_evidence_incomplete";
  if (caveat) reason = caveat;

  return {
    ...base,
    decision: "manual_hold",
    comparableKey: null,
    holdClass: reason,
    reason,
  };
}

function makeMarkdown(report: {
  generatedAt: string;
  category: string;
  lane: string;
  conclusion: string;
  metrics: Record<string, number | boolean>;
  rows: ReviewRow[];
  nextOwnerJudgmentPoints: string[];
}): string {
  const rowLines = report.rows.map((row) =>
    `| ${row.caseId} | ${row.decision} | ${row.modelKey ?? "null"} | ${row.comparableKey ?? "null"} | ${
      row.completeSetSignal
    } | ${row.holdClass ?? "null"} | ${markdownEscape(row.title)} |`,
  );

  return [
    "# Home Appliance Stick Vacuum Positive Backfill",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- category: ${report.category}`,
    `- lane: ${report.lane}`,
    `- conclusion: ${report.conclusion}`,
    "",
    "## Boundary",
    "",
    "- reportOnly: true",
    "- runtimeCatalogApply: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    "- productionDbMutation: false",
    "- directThirtyDayPlanEdit: false",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Strict Positive Rule Used",
    "",
    "A positive backfill row requires title-visible exact model evidence, a title-level complete-set signal, and local description evidence for main unit, charger, and a main head/tool. LG CodeZero A9/A9S, Samsung Bespoke Jet, Dyson V-series beyond the already approved Dyson V10/V8 rows, Xiaomi/Roborock, and other family rows remain manual/hold until owner subtype and complete-set semantics are decided.",
    "",
    "## Rows",
    "",
    "| caseId | decision | modelKey | comparableKey | completeSetSignal | holdClass | title |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rowLines,
    "",
    "## Owner/Main-Agent Judgment Points",
    "",
    ...report.nextOwnerJudgmentPoints.map((point) => `- ${point}`),
    "",
  ].join("\n");
}

function makeAuditMarkdown(audit: {
  generatedAt: string;
  conclusion: string;
  metrics: Record<string, number | boolean>;
  reasons: Array<{ reason: string; count: number }>;
  familyCoverage: Array<{ familyGroup: string; positiveRows: number; manualRows: number; holdRows: number }>;
}): string {
  return [
    "# Home Appliance Stick Vacuum Positive Backfill Audit",
    "",
    `- generatedAt: ${audit.generatedAt}`,
    `- conclusion: ${audit.conclusion}`,
    "",
    "## Metrics",
    "",
    ...Object.entries(audit.metrics).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Hold Reasons",
    "",
    "| reason | count |",
    "| --- | ---: |",
    ...audit.reasons.map((row) => `| ${row.reason} | ${row.count} |`),
    "",
    "## Family Coverage",
    "",
    "| familyGroup | positive | manual | hold |",
    "| --- | ---: | ---: | ---: |",
    ...audit.familyCoverage.map((row) => `| ${row.familyGroup} | ${row.positiveRows} | ${row.manualRows} | ${row.holdRows} |`),
    "",
    "## Audit Note",
    "",
    "The local sample pool does not support the requested 8-12 strict positive complete-set rows. The report therefore preserves only two strict positives and keeps the remaining exact/family rows in manual or negative hold instead of inflating runtime evidence.",
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const byPid = new Map(samples.map((sample) => [sample.pid, sample]));
  const rows = reviewPids.flatMap((pid, index) => {
    const sample = byPid.get(pid);
    return sample ? [classify(sample, index)] : [];
  });

  const positiveRows = rows.filter((row) => row.decision === "candidate_positive_contract_only");
  const manualRows = rows.filter((row) => row.decision === "manual_hold");
  const holdRows = rows.filter((row) => row.decision === "negative_hold");
  const positiveFamilyGroups = new Set(positiveRows.map((row) => row.familyGroup).filter((value): value is string => Boolean(value)));
  const reviewedFamilyGroups = new Set(rows.map((row) => row.familyGroup).filter((value): value is string => Boolean(value)));
  const strictGoalMet = positiveRows.length >= 8 && positiveRows.length <= 12 && positiveFamilyGroups.size >= 3;

  const report = {
    generatedAt,
    reportOnly: true,
    runtimeCatalogApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "home_appliance_tech_discovered",
    lane: "home_appliance_stick_vacuum_positive_backfill",
    inputFiles: [
      samplesPath,
      "reports/home-appliance-stick-vacuum-runtime-impact-review-2026-05-12.md",
      "reports/home-appliance-stick-vacuum-no-mutation-executor-latest.md",
      "reports/home-appliance-stick-vacuum-complete-set-contract-latest.md",
      "reports/category-orchestration-status-latest.md",
    ],
    metrics: {
      rows: rows.length,
      positiveRows: positiveRows.length,
      manualRows: manualRows.length,
      holdRows: holdRows.length,
      reviewedFamilyGroups: reviewedFamilyGroups.size,
      positiveFamilyGroups: positiveFamilyGroups.size,
      strictPositiveGoalMet: strictGoalMet,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    rows,
    conclusion: strictGoalMet
      ? "strict_positive_backfill_goal_met_report_only"
      : "strict_positive_backfill_goal_not_met_local_samples_only",
    nextOwnerJudgmentPoints: [
      "Do not runtime-wire the lane from this packet; strict positives remain only two Dyson rows.",
      "Decide whether LG CodeZero A9/A9S title family plus description model/component evidence can ever be promoted, and whether A9 variants share a comparable key.",
      "Decide whether stand/dock is optional or mandatory for complete-set eligibility after charger plus main head are present.",
      "Keep Samsung Bespoke Jet, Xiaomi/Roborock, robot, bedding, wet-dry/mop, and accessory-only rows out of the positive lane until subtype policies exist.",
      "Collect additional title-level exact-model complete-set marketplace samples before owner reconsiders internal-only runtime work.",
    ],
  };

  const reasonCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.holdClass) reasonCounts.set(row.holdClass, (reasonCounts.get(row.holdClass) ?? 0) + 1);
  }

  const familyCoverage = [...reviewedFamilyGroups].sort().map((familyGroup) => ({
    familyGroup,
    positiveRows: rows.filter((row) => row.familyGroup === familyGroup && row.decision === "candidate_positive_contract_only").length,
    manualRows: rows.filter((row) => row.familyGroup === familyGroup && row.decision === "manual_hold").length,
    holdRows: rows.filter((row) => row.familyGroup === familyGroup && row.decision === "negative_hold").length,
  }));

  const audit = {
    generatedAt,
    reportOnly: true,
    runtimeCatalogApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    inputReport: "reports/home-appliance-stick-vacuum-positive-backfill-latest.json",
    conclusion: "positive_backfill_audit_goal_gap_preserved",
    metrics: {
      reviewedRows: rows.length,
      strictPositiveRows: positiveRows.length,
      requiredMinPositiveRows: 8,
      requiredMaxPositiveRows: 12,
      requiredMinPositiveFamilyGroups: 3,
      strictPositiveGoalMet: strictGoalMet,
      manualOrHoldRowsPreserved: manualRows.length + holdRows.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    reasons: [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
    familyCoverage,
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "home-appliance-stick-vacuum-positive-backfill-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(reportsDir, "home-appliance-stick-vacuum-positive-backfill-latest.md"), `${makeMarkdown(report)}\n`);
  await writeFile(path.join(reportsDir, "home-appliance-stick-vacuum-positive-backfill-audit-latest.json"), `${JSON.stringify(audit, null, 2)}\n`);
  await writeFile(path.join(reportsDir, "home-appliance-stick-vacuum-positive-backfill-audit-latest.md"), `${makeAuditMarkdown(audit)}\n`);

  console.log(
    JSON.stringify(
      {
        conclusion: report.conclusion,
        rows: report.metrics.rows,
        positiveRows: report.metrics.positiveRows,
        manualRows: report.metrics.manualRows,
        holdRows: report.metrics.holdRows,
        runtimeApprovedRows: report.metrics.runtimeApprovedRows,
        publicPromotionRows: report.metrics.publicPromotionRows,
        candidatePoolWiringRows: report.metrics.candidatePoolWiringRows,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
