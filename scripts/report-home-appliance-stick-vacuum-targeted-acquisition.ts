import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type BunjangSearchItem = {
  pid: string;
  name: string;
  price: number;
  url: string;
  query: string;
  raw: Record<string, unknown>;
};

type BunjangDetail = {
  description: string;
  saleStatus: string;
  conditionLabel: string | null;
};

type Decision = "candidate_positive_contract_only" | "manual_hold" | "negative_hold";

type CompleteSetSignal = "title_complete_set" | "description_complete_set" | "missing_complete_set";

type AcquisitionRow = {
  caseId: string;
  source: "bunjang_public_api";
  query: string;
  sourcePid: string;
  sourceUrl: string;
  title: string;
  price: number | null;
  saleStatus: string;
  conditionLabel: string | null;
  decision: Decision;
  modelFamily: string | null;
  modelKey: string | null;
  comparableKey: string | null;
  familyGroup: string | null;
  titleExactModelVisible: boolean;
  completeSetSignal: CompleteSetSignal;
  componentEvidence: string[];
  holdClass: string | null;
  robotLaneHold: boolean;
  reason: string;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePoolReady: false;
};

const API_BASE = "https://api.bunjang.co.kr";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
  Origin: "https://m.bunjang.co.kr",
  Referer: "https://m.bunjang.co.kr/",
};

const reportsDir = path.join(process.cwd(), "reports");
const outputJsonPath = path.join(reportsDir, "home-appliance-stick-vacuum-targeted-acquisition-latest.json");
const outputMdPath = path.join(reportsDir, "home-appliance-stick-vacuum-targeted-acquisition-latest.md");

const inputFiles = {
  positiveBackfillMd: "reports/home-appliance-stick-vacuum-positive-backfill-latest.md",
  positiveBackfillJson: "reports/home-appliance-stick-vacuum-positive-backfill-latest.json",
  runtimeImpactReviewMd: "reports/home-appliance-stick-vacuum-runtime-impact-review-2026-05-12.md",
  completeSetContractMd: "reports/home-appliance-stick-vacuum-complete-set-contract-latest.md",
  completeSetContractJson: "reports/home-appliance-stick-vacuum-complete-set-contract-latest.json",
  normalizedSamplesJson: "category-intelligence/home_appliance_tech_discovered/normalized_samples.json",
};

const queries = [
  "다이슨 V8 풀세트 무선청소기",
  "다이슨 V10 풀세트 무선청소기",
  "다이슨 V11 풀세트 무선청소기",
  "다이슨 V12 풀세트 무선청소기",
  "LG 코드제로 A9 풀세트",
  "LG 코드제로 A9S 풀세트",
  "삼성 비스포크 제트 풀세트",
  "삼성 제트 무선청소기 충전기 포함",
  "드리미 V11 무선청소기 풀세트",
  "샤오미 G10 무선청소기 풀세트",
  "로보락 H7 무선청소기 풀세트",
  "로보락 무선청소기 H6 풀세트",
  "LG 코드제로 A9S 무선청소기",
  "비스포크제트 220W 풀세트",
  "드리미 V10 무선청소기",
  "샤오미 드리미 무선청소기",
  "로보락 H6 무선청소기",
  "로봇청소기 풀세트",
  "물걸레 청소기 풀세트",
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

function markdownEscape(value: string | null): string {
  return (value ?? "null").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function toInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readRequiredInputs(): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    Object.entries(inputFiles).map(async ([key, file]) => {
      const raw = await readFile(path.join(process.cwd(), file), "utf8");
      if (file.endsWith(".json")) {
        const parsed = JSON.parse(raw);
        return [
          key,
          {
            path: file,
            bytes: raw.length,
            kind: Array.isArray(parsed) ? "array" : "object",
            rows: Array.isArray(parsed) ? parsed.length : Array.isArray(parsed.rows) ? parsed.rows.length : null,
            metrics: !Array.isArray(parsed) && parsed.metrics ? parsed.metrics : null,
          },
        ] as const;
      }
      return [key, { path: file, bytes: raw.length, kind: "markdown" }] as const;
    }),
  );
  return Object.fromEntries(entries);
}

async function searchPage(query: string, limit = 8): Promise<BunjangSearchItem[]> {
  const url = new URL(`${API_BASE}/api/1/find_v2.json`);
  url.searchParams.set("q", query);
  url.searchParams.set("order", "score");
  url.searchParams.set("page", "0");
  url.searchParams.set("n", String(limit));
  url.searchParams.set("stat_device", "w");
  url.searchParams.set("req_ref", "search");
  url.searchParams.set("stat_category_required", "1");
  url.searchParams.set("version", "4");

  const res = await fetch(url.toString(), { headers: HEADERS, signal: AbortSignal.timeout(5_000) });
  if (!res.ok) return [];
  const data = await res.json();
  const list: unknown[] = Array.isArray(data?.list) ? data.list : [];
  return list
    .map((raw): BunjangSearchItem => {
      const item = raw as Record<string, unknown>;
      const pid = String(item.pid ?? "");
      return {
        pid,
        name: String(item.name ?? ""),
        price: toInt(item.price),
        url: `https://m.bunjang.co.kr/products/${pid}`,
        query,
        raw: item,
      };
    })
    .filter((item) => item.pid && item.name);
}

async function fetchDetail(pid: string): Promise<BunjangDetail> {
  const url = `${API_BASE}/api/pms/v1/products/${pid}/detail/web`;
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6_000) });
  if (!res.ok) {
    return { description: "", saleStatus: "unknown", conditionLabel: null };
  }
  const json = await res.json();
  const product = json?.data?.product ?? {};
  const condition = product?.condition;
  const conditionLabel =
    typeof condition === "object" && condition
      ? stringOrNull((condition as Record<string, unknown>).label) ?? stringOrNull((condition as Record<string, unknown>).name)
      : stringOrNull(condition);
  return {
    description: String(product?.description ?? "").slice(0, 1800),
    saleStatus: String(product?.saleStatus ?? "unknown"),
    conditionLabel,
  };
}

function inferModel(title: string): Pick<
  AcquisitionRow,
  "modelFamily" | "modelKey" | "familyGroup" | "titleExactModelVisible"
> {
  const text = compact(title);
  const candidates: Array<{
    pattern: RegExp;
    modelFamily: string;
    modelKey: string;
    familyGroup: string;
  }> = [
    { pattern: /(?:다이슨|dyson).{0,12}v15|v15.{0,12}(?:다이슨|dyson)/, modelFamily: "Dyson V15", modelKey: "dyson-v15", familyGroup: "dyson_v_series" },
    { pattern: /(?:다이슨|dyson).{0,12}v12|v12.{0,12}(?:다이슨|dyson)/, modelFamily: "Dyson V12", modelKey: "dyson-v12", familyGroup: "dyson_v_series" },
    { pattern: /(?:다이슨|dyson).{0,12}v11|v11.{0,12}(?:다이슨|dyson)/, modelFamily: "Dyson V11", modelKey: "dyson-v11", familyGroup: "dyson_v_series" },
    { pattern: /(?:다이슨|dyson).{0,12}v10|v10.{0,12}(?:다이슨|dyson)|싸이클론v10|cyclonev10|카본파이버/, modelFamily: "Dyson V10", modelKey: "dyson-v10", familyGroup: "dyson_v_series" },
    { pattern: /(?:다이슨|dyson).{0,12}v8|v8.{0,12}(?:다이슨|dyson)/, modelFamily: "Dyson V8", modelKey: "dyson-v8", familyGroup: "dyson_v_series" },
    { pattern: /(?:다이슨|dyson).{0,12}v7|v7.{0,12}(?:다이슨|dyson)/, modelFamily: "Dyson V7", modelKey: "dyson-v7", familyGroup: "dyson_v_series" },
    { pattern: /(?:lg|엘지|코드제로|codezero).{0,20}a9s|a9s.{0,20}(?:lg|엘지|코드제로|codezero)/, modelFamily: "LG CodeZero A9S", modelKey: "lg-codezero-a9s", familyGroup: "lg_codezero" },
    { pattern: /(?:lg|엘지|코드제로|codezero).{0,20}a9|a9.{0,20}(?:lg|엘지|코드제로|codezero)/, modelFamily: "LG CodeZero A9", modelKey: "lg-codezero-a9", familyGroup: "lg_codezero" },
    { pattern: /(?:삼성|samsung).{0,16}(?:비스포크)?제트|비스포크제트|bespokejet/, modelFamily: "Samsung Bespoke Jet", modelKey: "samsung-bespoke-jet", familyGroup: "samsung_bespoke_jet" },
    { pattern: /(?:드리미|dreame).{0,12}v12|v12.{0,12}(?:드리미|dreame)/, modelFamily: "Dreame V12", modelKey: "dreame-v12", familyGroup: "xiaomi_dreame_roborock" },
    { pattern: /(?:드리미|dreame).{0,12}v11|v11.{0,12}(?:드리미|dreame)/, modelFamily: "Dreame V11", modelKey: "dreame-v11", familyGroup: "xiaomi_dreame_roborock" },
    { pattern: /(?:드리미|dreame).{0,12}v10s?|v10s?.{0,12}(?:드리미|dreame)/, modelFamily: "Dreame V10/V10s", modelKey: "dreame-v10s", familyGroup: "xiaomi_dreame_roborock" },
    { pattern: /(?:드리미|dreame).{0,12}t30|t30.{0,12}(?:드리미|dreame)/, modelFamily: "Dreame T30", modelKey: "dreame-t30", familyGroup: "xiaomi_dreame_roborock" },
    { pattern: /(?:샤오미|xiaomi).{0,12}g10|g10.{0,12}(?:샤오미|xiaomi)|(?:샤오미|xiaomi).{0,12}v10|vvn3/, modelFamily: "Xiaomi G10/V10", modelKey: "xiaomi-g10-v10", familyGroup: "xiaomi_dreame_roborock" },
    { pattern: /(?:로보락|roborock).{0,12}h7|h7.{0,12}(?:로보락|roborock)/, modelFamily: "Roborock H7", modelKey: "roborock-h7", familyGroup: "xiaomi_dreame_roborock" },
    { pattern: /(?:로보락|roborock).{0,12}h60|h60.{0,12}(?:로보락|roborock)/, modelFamily: "Roborock H60", modelKey: "roborock-h60", familyGroup: "xiaomi_dreame_roborock" },
    { pattern: /(?:로보락|roborock).{0,12}h6|h6.{0,12}(?:로보락|roborock)/, modelFamily: "Roborock H6", modelKey: "roborock-h6", familyGroup: "xiaomi_dreame_roborock" },
  ];
  const match = candidates.find((candidate) => candidate.pattern.test(text));
  if (!match) {
    return { modelFamily: null, modelKey: null, familyGroup: null, titleExactModelVisible: false };
  }
  return {
    modelFamily: match.modelFamily,
    modelKey: match.modelKey,
    familyGroup: match.familyGroup,
    titleExactModelVisible: true,
  };
}

function completeSetSignal(title: string, description: string): CompleteSetSignal {
  const titleText = normalizeText(title);
  const allText = normalizeText(`${title}\n${description}`);
  if (/풀세트|풀\s*세트|풀구성|충전기\s*포함|충전기포함|모두\s*포함|전부\s*포함|포함\s*판매|구성품\s*포함/.test(titleText)) {
    return "title_complete_set";
  }
  if (/풀세트|풀\s*세트|풀구성|구성품|구성품\s*다|충전기\s*포함|충전기포함|모두\s*포함|전부\s*포함|본체.{0,30}(헤드|브러시|브러쉬|툴|연장관).{0,30}충전기|충전기.{0,30}(헤드|브러시|브러쉬|툴|연장관)/.test(allText)) {
    return "description_complete_set";
  }
  return "missing_complete_set";
}

function componentEvidence(title: string, description: string): string[] {
  const text = normalizeText(`${title}\n${description}`);
  const signals: Array<[RegExp, string]> = [
    [/본체|청소기|무선청소기/, "main_unit"],
    [/충전기|충전\s*어댑터|어댑터|아답터|충전대/, "charger"],
    [/헤드|브러쉬|브러시|연장관|흡입봉|툴|tool|소프트롤러|마루/, "main_head_or_tool"],
    [/스탠드|거치대|크래들|스테이션/, "stand_or_holder"],
    [/배터리|밧데리/, "battery"],
  ];
  return signals.filter(([pattern]) => pattern.test(text)).map(([, signal]) => signal);
}

function classify(item: BunjangSearchItem, detail: BunjangDetail, index: number): AcquisitionRow {
  const title = item.name;
  const description = detail.description;
  const model = inferModel(title);
  const setSignal = completeSetSignal(title, description);
  const components = componentEvidence(title, description);
  const text = normalizeText(`${title}\n${description}`);
  const titleText = normalizeText(title);

  const robot = /로봇청소기|로봇\s*청소기|클린베이스|자동먼지통|나르왈|룸바/.test(text);
  const bedding = /침구청소기|침구\s*청소기|레이캅/.test(text);
  const wetDry = /물걸레|습식|건습식|건식\s*습식|욕실청소기|듀얼스핀|스핀\s*청소기/.test(text);
  const accessoryOnly = /충전기|어댑터|아답터|배터리|밧데리|필터|헤드|브러쉬|브러시|거치대|스탠드|크래들|키트|봉투|걸레|패드|롤러/.test(titleText) &&
    !/무선청소기|청소기\s*본체|청소기\s*풀|풀세트|본체/.test(titleText);
  const incomplete = /본체만|본체\s*만|단품|충전기\s*없|충전기\s*무|헤드\s*없|브러시\s*없|브러쉬\s*없|스탠드\s*제외|별도|추가금|추가\s*구매|미포함/.test(text);
  const conditionCaveat = /고장|하자|방전|부품용|작동\s*불|호환\s*배터리|리필\s*배터리|배터리.{0,8}리필|배터리.{0,8}방전/.test(text);
  const missingComplete = setSignal === "missing_complete_set";
  const hasRequiredComponents =
    components.includes("main_unit") && components.includes("charger") && components.includes("main_head_or_tool");

  let decision: Decision = "manual_hold";
  let holdClass: string | null = null;
  let reason = "";

  if (robot) {
    decision = "negative_hold";
    holdClass = "out_of_lane_robot_vacuum";
    reason = "Robot vacuum or dock/base-station wording is out of this stick-vacuum lane and remains a separate hold lane.";
  } else if (bedding) {
    decision = "negative_hold";
    holdClass = "out_of_lane_bedding_cleaner";
    reason = "Bedding cleaner wording is out of the stick/handheld vacuum lane.";
  } else if (wetDry) {
    decision = "negative_hold";
    holdClass = "out_of_lane_wet_dry_mop_or_consumable";
    reason = "Wet/dry, mop, spin, or bathroom cleaner wording is out of this lane.";
  } else if (accessoryOnly) {
    decision = "negative_hold";
    holdClass = "accessory_or_part_only";
    reason = "Title reads as charger, battery, filter, head, stand, dock, kit, pad, or other accessory-only listing.";
  } else if (!model.titleExactModelVisible) {
    decision = "manual_hold";
    holdClass = "missing_exact_model";
    reason = "No title-visible exact model token for strict positive matching.";
  } else if (incomplete) {
    decision = "manual_hold";
    holdClass = "incomplete_or_extra_fee_component";
    reason = "Listing has exclusion, missing-component, body-only, or extra-fee component wording.";
  } else if (conditionCaveat) {
    decision = "manual_hold";
    holdClass = "condition_or_battery_caveat";
    reason = "Condition, repair, replacement, compatible battery, or defect wording needs owner policy before positive use.";
  } else if (missingComplete) {
    decision = "manual_hold";
    holdClass = "missing_complete_set";
    reason = "Exact model is visible, but complete-set wording/evidence is absent.";
  } else if (!hasRequiredComponents) {
    decision = "manual_hold";
    holdClass = "component_evidence_incomplete";
    reason = "Complete-set wording exists, but body, charger, and main head/tool evidence is not complete in title/description.";
  } else {
    decision = "candidate_positive_contract_only";
    holdClass = null;
    reason = "Title-visible exact model plus complete-set signal and body, charger, and main head/tool evidence. Report-only candidate; no runtime approval.";
  }

  return {
    caseId: `VACUUM-TARGETED-${String(index + 1).padStart(3, "0")}`,
    source: "bunjang_public_api",
    query: item.query,
    sourcePid: item.pid,
    sourceUrl: item.url,
    title,
    price: item.price || null,
    saleStatus: detail.saleStatus,
    conditionLabel: detail.conditionLabel,
    decision,
    modelFamily: model.modelFamily,
    modelKey: model.modelKey,
    comparableKey:
      decision === "candidate_positive_contract_only" && model.modelKey
        ? `stick_vacuum|${model.modelKey}|complete_set`
        : null,
    familyGroup: model.familyGroup,
    titleExactModelVisible: model.titleExactModelVisible,
    completeSetSignal: setSignal,
    componentEvidence: components,
    holdClass,
    robotLaneHold: robot,
    reason,
    runtimeApproved: false,
    publicPromotion: false,
    candidatePoolReady: false,
  };
}

function buildMarkdown(report: Record<string, unknown>, rows: AcquisitionRow[]): string {
  const metrics = report.metrics as Record<string, unknown>;
  const positives = rows.filter((row) => row.decision === "candidate_positive_contract_only");
  const manual = rows.filter((row) => row.decision === "manual_hold");
  const hold = rows.filter((row) => row.decision === "negative_hold");

  const lines = [
    "# Home Appliance Stick Vacuum Targeted Acquisition",
    "",
    `- generatedAt: ${report.generatedAt}`,
    "- category: home_appliance_tech_discovered",
    "- lane: home_appliance_stick_vacuum_targeted_acquisition",
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
    `- queriedRows: ${metrics.queriedRows}`,
    `- reviewedRows: ${metrics.reviewedRows}`,
    `- candidatePositiveContractOnlyRows: ${metrics.candidatePositiveContractOnlyRows}`,
    `- manualHoldRows: ${metrics.manualHoldRows}`,
    `- negativeHoldRows: ${metrics.negativeHoldRows}`,
    `- positiveFamilyGroups: ${metrics.positiveFamilyGroups}`,
    `- robotLaneHoldRows: ${metrics.robotLaneHoldRows}`,
    `- runtimeApprovedRows: ${metrics.runtimeApprovedRows}`,
    `- publicPromotionRows: ${metrics.publicPromotionRows}`,
    `- candidatePoolWiringRows: ${metrics.candidatePoolWiringRows}`,
    "",
    "## Strict Positive Rule Used",
    "",
    "A positive acquisition row requires title-visible exact model evidence, title or description complete-set evidence, and main unit, charger, and main head/tool evidence. Accessory-only, robot vacuum, bedding cleaner, wet-dry/mop, consumable, missing exact model, missing complete-set, incomplete, and condition-caveat rows remain hold/manual.",
    "",
    "## Positive Candidates",
    "",
    "| caseId | modelKey | comparableKey | title | query |",
    "| --- | --- | --- | --- | --- |",
    ...positives.map((row) =>
      `| ${row.caseId} | ${markdownEscape(row.modelKey)} | ${markdownEscape(row.comparableKey)} | ${markdownEscape(row.title)} | ${markdownEscape(row.query)} |`,
    ),
    "",
    "## Manual Holds",
    "",
    "| caseId | holdClass | modelKey | completeSetSignal | title |",
    "| --- | --- | --- | --- | --- |",
    ...manual.map((row) =>
      `| ${row.caseId} | ${markdownEscape(row.holdClass)} | ${markdownEscape(row.modelKey)} | ${row.completeSetSignal} | ${markdownEscape(row.title)} |`,
    ),
    "",
    "## Negative Holds",
    "",
    "| caseId | holdClass | modelKey | completeSetSignal | title |",
    "| --- | --- | --- | --- | --- |",
    ...hold.map((row) =>
      `| ${row.caseId} | ${markdownEscape(row.holdClass)} | ${markdownEscape(row.modelKey)} | ${row.completeSetSignal} | ${markdownEscape(row.title)} |`,
    ),
    "",
    "## Acquisition Plan",
    "",
    "- Keep targeting title queries that combine exact model token plus 풀세트/충전기 포함 language.",
    "- Prioritize LG CodeZero A9/A9S, Samsung Bespoke Jet, Dyson V-series, and Xiaomi/Dreame/Roborock handstick rows with visible body, charger, and main head/tool evidence.",
    "- Keep robot vacuum, bedding cleaner, wet-dry/mop, consumable, accessory-only, missing exact model, and incomplete/condition-caveat rows out of positives.",
    "- Do not wire runtime, public promotion, candidate pool, Supabase, cron, lifecycle, pack UI, or catalog changes from this report.",
    "",
    "## Next Owner Judgment Points",
    "",
    "- Decide whether LG CodeZero A9/A9S family-level exact-model semantics can share a comparable key or need variant-specific keys.",
    "- Decide whether stand/dock stays optional after body, charger, and main head/tool evidence are present.",
    "- Re-run this targeted fetch before runtime review because marketplace availability changes quickly.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const inputs = await readRequiredInputs();
  const seen = new Map<string, BunjangSearchItem>();

  for (const query of queries) {
    const items = await searchPage(query, 8);
    for (const item of items) {
      if (!seen.has(item.pid)) seen.set(item.pid, item);
    }
    await sleep(150);
  }

  const targetedItems = [...seen.values()].slice(0, 80);
  const rows: AcquisitionRow[] = [];
  for (const item of targetedItems) {
    const detail = await fetchDetail(item.pid);
    rows.push(classify(item, detail, rows.length));
    await sleep(100);
  }

  const positiveRows = rows.filter((row) => row.decision === "candidate_positive_contract_only");
  const manualRows = rows.filter((row) => row.decision === "manual_hold");
  const negativeRows = rows.filter((row) => row.decision === "negative_hold");
  const positiveFamilyGroups = new Set(positiveRows.map((row) => row.familyGroup).filter(Boolean)).size;
  const metrics = {
    queriedRows: targetedItems.length,
    reviewedRows: rows.length,
    candidatePositiveContractOnlyRows: positiveRows.length,
    manualHoldRows: manualRows.length,
    negativeHoldRows: negativeRows.length,
    positiveFamilyGroups,
    robotLaneHoldRows: rows.filter((row) => row.robotLaneHold).length,
    runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
    publicPromotionRows: rows.filter((row) => row.publicPromotion).length,
    candidatePoolWiringRows: rows.filter((row) => row.candidatePoolReady).length,
    strictGoalMet: positiveRows.length >= 8 && positiveRows.length <= 12 && positiveFamilyGroups >= 3,
  };

  const report = {
    generatedAt,
    reportOnly: true,
    runtimeCatalogApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "home_appliance_tech_discovered",
    lane: "home_appliance_stick_vacuum_targeted_acquisition",
    inputFiles,
    inputReadSummary: inputs,
    networkCalls: {
      allowedSurface: "Bunjang public API only",
      openAiCalls: 0,
      supabaseCalls: 0,
      queryCount: queries.length,
      queries,
    },
    strictPositiveRule:
      "title-visible exact model + title/description complete-set evidence + main unit, charger, and main head/tool; accessory-only, robot vacuum, bedding cleaner, wet-dry/mop, consumable, missing exact model, incomplete, and condition-caveat rows hold",
    metrics,
    rows,
    acquisitionPlan: [
      "Continue exact-model plus 풀세트/충전기 포함 targeted queries.",
      "Prefer LG A9/A9S, Samsung Bespoke Jet, Dyson V-series, Xiaomi/Dreame/Roborock handstick rows with component evidence in public detail text.",
      "Keep robot vacuum as a separate hold lane.",
      "No runtime, public promotion, candidate pool, Supabase, cron, lifecycle, pack UI, catalog, or 30-day-plan mutation from this packet.",
    ],
    conclusion: metrics.strictGoalMet
      ? "targeted_positive_goal_met_report_only_no_runtime_approval"
      : "targeted_positive_goal_not_met_report_only_continue_acquisition",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(outputMdPath, buildMarkdown(report, rows));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
