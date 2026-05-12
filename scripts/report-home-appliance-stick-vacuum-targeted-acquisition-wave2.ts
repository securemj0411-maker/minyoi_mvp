import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type BunjangSearchItem = {
  pid: string;
  name: string;
  price: number | null;
  url: string;
  query: string;
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
  candidatePool: false;
  runtimeApply: false;
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
const outputJsonPath = path.join(reportsDir, "home-appliance-stick-vacuum-targeted-acquisition-wave2-latest.json");
const outputMdPath = path.join(reportsDir, "home-appliance-stick-vacuum-targeted-acquisition-wave2-latest.md");

const inputFiles = {
  categoryOrchestrationStatusMd: "reports/category-orchestration-status-latest.md",
  categoryOrchestrationStatusJson: "reports/category-orchestration-status-latest.json",
  targetedAcquisitionMd: "reports/home-appliance-stick-vacuum-targeted-acquisition-latest.md",
  targetedAcquisitionJson: "reports/home-appliance-stick-vacuum-targeted-acquisition-latest.json",
  positiveBackfillMd: "reports/home-appliance-stick-vacuum-positive-backfill-latest.md",
  positiveBackfillJson: "reports/home-appliance-stick-vacuum-positive-backfill-latest.json",
  completeSetContractMd: "reports/home-appliance-stick-vacuum-complete-set-contract-latest.md",
  completeSetContractJson: "reports/home-appliance-stick-vacuum-complete-set-contract-latest.json",
  runtimeImpactReviewMd: "reports/home-appliance-stick-vacuum-runtime-impact-review-2026-05-12.md",
};

const queries = [
  "LG 코드제로 A9 풀세트 무선청소기",
  "LG 코드제로 A9 충전기 헤드",
  "LG 코드제로 A9 올인원타워 풀세트",
  "엘지 코드제로 A9 풀구성",
  "LG 코드제로 A9S 풀세트 무선청소기",
  "LG 코드제로 A9S 충전기 헤드",
  "LG 코드제로 A9S 올인원타워",
  "LG 오브제 A9S 풀세트",
  "엘지 코드제로 A9S 풀구성",
  "삼성 비스포크 제트 풀세트",
  "삼성 비스포크 제트 충전기 헤드",
  "삼성 제트 무선청소기 풀세트",
  "비스포크제트 220W 풀세트",
  "드리미 V10 무선청소기 풀세트",
  "드리미 V11 무선청소기 풀세트",
  "드리미 V12 무선청소기 풀세트",
  "샤오미 드리미 무선청소기 풀구성",
  "샤오미 G10 무선청소기 풀세트",
  "로보락 H6 무선청소기 풀세트",
  "로보락 H7 무선청소기 풀세트",
  "로보락 H60 무선청소기 풀세트",
  "아이닉 i50 풀세트",
  "아이닉 i50 아이타워 풀세트",
  "아이닉 i50 본체 헤드 아이타워",
  "디베아 차이슨 무선청소기 풀세트",
  "디베아 무선청소기 충전기 헤드",
  "일렉트로룩스 에르고라피도 풀세트",
  "일렉트로룩스 에르고라피도 충전기 헤드",
  "테팔 에어포스 무선청소기 풀세트",
  "테팔 에어포스 충전기 헤드",
  "차이슨 무선청소기 풀세트",
  "무선청소기 본체 충전기 헤드 풀세트",
  "로봇청소기 풀세트",
  "물걸레 청소기 풀세트",
  "침구청소기 풀세트",
  "청소기 배터리 충전기 헤드",
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

function toInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
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
      if (!file.endsWith(".json")) return [key, { path: file, bytes: raw.length, kind: "markdown" }] as const;
      const parsed: unknown = JSON.parse(raw);
      const objectParsed = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
      const rows = Array.isArray(parsed)
        ? parsed.length
        : Array.isArray((objectParsed as { rows?: unknown }).rows)
          ? (objectParsed as { rows: unknown[] }).rows.length
          : null;
      return [key, { path: file, bytes: raw.length, kind: Array.isArray(parsed) ? "array" : "object", rows }] as const;
    }),
  );
  return Object.fromEntries(entries);
}

async function searchPage(query: string, page: number, limit = 10): Promise<BunjangSearchItem[]> {
  const url = new URL(`${API_BASE}/api/1/find_v2.json`);
  url.searchParams.set("q", query);
  url.searchParams.set("order", "score");
  url.searchParams.set("page", String(page));
  url.searchParams.set("n", String(limit));
  url.searchParams.set("stat_device", "w");
  url.searchParams.set("req_ref", "search");
  url.searchParams.set("stat_category_required", "1");
  url.searchParams.set("version", "4");

  const res = await fetch(url.toString(), { headers: HEADERS, signal: AbortSignal.timeout(5_000) });
  if (!res.ok) return [];
  const data: unknown = await res.json();
  const list = Array.isArray((data as { list?: unknown[] })?.list) ? (data as { list: Record<string, unknown>[] }).list : [];
  return list
    .map((item) => {
      const pid = String(item.pid ?? "");
      return {
        pid,
        name: String(item.name ?? ""),
        price: toInt(item.price),
        url: `https://m.bunjang.co.kr/products/${pid}`,
        query,
      };
    })
    .filter((item) => item.pid && item.name);
}

async function fetchDetail(pid: string): Promise<BunjangDetail> {
  const url = `${API_BASE}/api/pms/v1/products/${pid}/detail/web`;
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6_000) });
  if (!res.ok) return { description: "", saleStatus: "unknown", conditionLabel: null };
  const json: unknown = await res.json();
  const product = (json as { data?: { product?: Record<string, unknown> } })?.data?.product ?? {};
  const condition = product.condition;
  const conditionLabel =
    typeof condition === "object" && condition !== null
      ? stringOrNull((condition as Record<string, unknown>).label) ?? stringOrNull((condition as Record<string, unknown>).name)
      : stringOrNull(condition);
  return {
    description: String(product.description ?? "").slice(0, 2200),
    saleStatus: String(product.saleStatus ?? "unknown"),
    conditionLabel,
  };
}

function inferModel(title: string): Pick<
  AcquisitionRow,
  "modelFamily" | "modelKey" | "familyGroup" | "titleExactModelVisible"
> {
  const text = compact(title);
  const candidates: Array<{ pattern: RegExp; modelFamily: string; modelKey: string; familyGroup: string }> = [
    { pattern: /(?:lg|엘지|코드제로|codezero|오브제).{0,24}a9s|a9s.{0,24}(?:lg|엘지|코드제로|codezero|오브제)/, modelFamily: "LG CodeZero A9S", modelKey: "lg-codezero-a9s", familyGroup: "lg_codezero" },
    { pattern: /(?:lg|엘지|코드제로|codezero).{0,24}a9|a9.{0,24}(?:lg|엘지|코드제로|codezero)/, modelFamily: "LG CodeZero A9", modelKey: "lg-codezero-a9", familyGroup: "lg_codezero" },
    { pattern: /(?:삼성|samsung).{0,18}(?:비스포크)?제트|비스포크제트|bespokejet|제트220w|제트200w/, modelFamily: "Samsung Bespoke Jet", modelKey: "samsung-bespoke-jet", familyGroup: "samsung_bespoke_jet" },
    { pattern: /(?:드리미|dreame).{0,12}v12|v12.{0,12}(?:드리미|dreame)/, modelFamily: "Dreame V12", modelKey: "dreame-v12", familyGroup: "dreame_roborock_handstick" },
    { pattern: /(?:드리미|dreame).{0,12}v11|v11.{0,12}(?:드리미|dreame)/, modelFamily: "Dreame V11", modelKey: "dreame-v11", familyGroup: "dreame_roborock_handstick" },
    { pattern: /(?:드리미|dreame).{0,12}v10s?|v10s?.{0,12}(?:드리미|dreame)/, modelFamily: "Dreame V10/V10s", modelKey: "dreame-v10s", familyGroup: "dreame_roborock_handstick" },
    { pattern: /(?:드리미|dreame).{0,12}t30|t30.{0,12}(?:드리미|dreame)/, modelFamily: "Dreame T30", modelKey: "dreame-t30", familyGroup: "dreame_roborock_handstick" },
    { pattern: /(?:샤오미|xiaomi).{0,12}g10|g10.{0,12}(?:샤오미|xiaomi)|(?:샤오미|xiaomi).{0,12}v10/, modelFamily: "Xiaomi G10/V10", modelKey: "xiaomi-g10-v10", familyGroup: "dreame_roborock_handstick" },
    { pattern: /(?:로보락|roborock).{0,12}h7|h7.{0,12}(?:로보락|roborock)/, modelFamily: "Roborock H7", modelKey: "roborock-h7", familyGroup: "dreame_roborock_handstick" },
    { pattern: /(?:로보락|roborock).{0,12}h60|h60.{0,12}(?:로보락|roborock)/, modelFamily: "Roborock H60", modelKey: "roborock-h60", familyGroup: "dreame_roborock_handstick" },
    { pattern: /(?:로보락|roborock).{0,12}h6|h6.{0,12}(?:로보락|roborock)/, modelFamily: "Roborock H6", modelKey: "roborock-h6", familyGroup: "dreame_roborock_handstick" },
    { pattern: /(?:아이닉|inic).{0,12}i50|i50.{0,12}(?:아이닉|inic)/, modelFamily: "iNIK i50", modelKey: "inik-i50", familyGroup: "other_handstick" },
    { pattern: /(?:디베아|dibea).{0,18}(?:차이슨|무선청소기)|(?:차이슨).{0,18}(?:디베아|dibea)/, modelFamily: "Dibea Chaison", modelKey: "dibea-chaison", familyGroup: "other_handstick" },
    { pattern: /(?:일렉트로룩스|electrolux).{0,18}(?:에르고라피도|ergorapido)|(?:에르고라피도|ergorapido).{0,18}(?:일렉트로룩스|electrolux)/, modelFamily: "Electrolux Ergorapido", modelKey: "electrolux-ergorapido", familyGroup: "other_handstick" },
    { pattern: /(?:테팔|tefal).{0,18}(?:에어포스|airforce|엑스퍼트)|(?:에어포스|airforce|엑스퍼트).{0,18}(?:테팔|tefal)/, modelFamily: "Tefal Air Force", modelKey: "tefal-air-force", familyGroup: "other_handstick" },
  ];
  const match = candidates.find((candidate) => candidate.pattern.test(text));
  if (!match) return { modelFamily: null, modelKey: null, familyGroup: null, titleExactModelVisible: false };
  return { ...match, titleExactModelVisible: true };
}

function completeSetSignal(title: string, description: string): CompleteSetSignal {
  const titleText = normalizeText(title);
  const allText = normalizeText(`${title}\n${description}`);
  if (/풀세트|풀\s*세트|풀구성|풀\s*구성|전체구성|전체\s*구성|올인원\s*타워|올인원타워|충전기\s*포함|충전기포함|구성품\s*포함/.test(titleText)) {
    return "title_complete_set";
  }
  if (/풀세트|풀\s*세트|풀구성|풀\s*구성|구성품|전체구성|전체\s*구성|올인원\s*타워|올인원타워|충전기\s*포함|충전기포함|모두\s*포함|전부\s*포함|본체.{0,40}(충전기|충전대|어댑터).{0,40}(헤드|브러시|브러쉬|툴|연장관)|충전기.{0,40}(본체|청소기).{0,40}(헤드|브러시|브러쉬|툴|연장관)/.test(allText)) {
    return "description_complete_set";
  }
  return "missing_complete_set";
}

function componentEvidence(title: string, description: string): string[] {
  const text = normalizeText(`${title}\n${description}`);
  const signals: Array<[RegExp, string]> = [
    [/본체|청소기|무선청소기|핸디스틱|스틱청소기/, "main_unit"],
    [/충전기|충전\s*어댑터|어댑터|아답터|충전대|올인원\s*타워|올인원타워|아이\s*타워|아이타워|청정스테이션/, "charger"],
    [/헤드|브러쉬|브러시|헤드브러시|헤드브러쉬|연장관|흡입봉|흡입구|툴|tool|소프트롤러|마루|틈새|노즐/, "main_head_or_tool"],
    [/스탠드|거치대|크래들|스테이션|타워/, "stand_or_holder"],
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
  const robot = /로봇청소기|로봇\s*청소기|클린베이스|자동먼지통|나르왈|룸바|로청|유리창\s*로봇/.test(text);
  const bedding = /침구청소기|침구\s*청소기|레이캅/.test(text) || /침구브러쉬|침구브러시/.test(titleText);
  const wetDry = /물걸레|습식|건습식|건식\s*습식|욕실청소기|듀얼스핀|스핀\s*청소기|패드/.test(text);
  const accessoryOnly =
    /충전기|어댑터|아답터|배터리|밧데리|필터|헤드|브러쉬|브러시|거치대|스탠드|크래들|키트|봉투|걸레|패드|롤러|소모품|부품/.test(titleText) &&
    !/무선청소기|스틱청소기|핸디스틱|청소기\s*본체|청소기\s*풀|풀세트|풀구성|본체/.test(titleText);
  const incomplete = /본체만|본체\s*만|단품|충전기\s*없|충전기\s*무|헤드\s*없|브러시\s*없|브러쉬\s*없|스탠드\s*제외|별도|추가금|추가\s*구매|미포함|침구세트\s*제외/.test(text);
  const conditionCaveat = /고장|하자|방전|부품용|작동\s*불|호환\s*배터리|리필\s*배터리|배터리.{0,8}리필|배터리.{0,8}방전/.test(text);
  const hasRequiredComponents =
    components.includes("main_unit") && components.includes("charger") && components.includes("main_head_or_tool");

  let decision: Decision = "manual_hold";
  let holdClass: string | null = null;
  let reason = "";

  if (robot) {
    decision = "negative_hold";
    holdClass = "out_of_lane_robot_vacuum";
    reason = "Robot vacuum or dock/base-station wording is out of this stick-vacuum lane.";
  } else if (bedding) {
    decision = "negative_hold";
    holdClass = "out_of_lane_bedding_cleaner";
    reason = "Bedding cleaner or bedding-brush wording remains hold/manual for this lane.";
  } else if (wetDry) {
    decision = "negative_hold";
    holdClass = "out_of_lane_wet_dry_mop_or_consumable";
    reason = "Wet/dry, mop, spin, bathroom cleaner, or consumable wording is out of this lane.";
  } else if (accessoryOnly) {
    decision = "negative_hold";
    holdClass = "accessory_or_part_only";
    reason = "Title reads as accessory, consumable, or part-only listing.";
  } else if (!model.titleExactModelVisible) {
    decision = "manual_hold";
    holdClass = "missing_exact_model";
    reason = "No title-visible exact model token for strict positive matching.";
  } else if (incomplete) {
    decision = "manual_hold";
    holdClass = "incomplete_or_extra_fee_component";
    reason = "Listing has exclusion, missing-component, body-only, or extra-fee wording.";
  } else if (conditionCaveat) {
    decision = "manual_hold";
    holdClass = "condition_or_battery_caveat";
    reason = "Condition, repair, replacement, compatible battery, or defect wording needs owner policy.";
  } else if (setSignal === "missing_complete_set") {
    decision = "manual_hold";
    holdClass = "missing_complete_set";
    reason = "Exact model is visible, but complete-set wording/evidence is absent.";
  } else if (!hasRequiredComponents) {
    decision = "manual_hold";
    holdClass = "component_evidence_incomplete";
    reason = "Complete-set wording exists, but body, charger, and main head/tool evidence is not all visible.";
  } else {
    decision = "candidate_positive_contract_only";
    reason = "Title-visible exact model plus complete-set signal and body, charger, and main head/tool evidence. Report-only candidate; no runtime approval.";
  }

  return {
    caseId: `VACUUM-TARGETED-W2-${String(index + 1).padStart(3, "0")}`,
    source: "bunjang_public_api",
    query: item.query,
    sourcePid: item.pid,
    sourceUrl: item.url,
    title,
    price: item.price,
    saleStatus: detail.saleStatus,
    conditionLabel: detail.conditionLabel,
    decision,
    modelFamily: model.modelFamily,
    modelKey: model.modelKey,
    comparableKey: decision === "candidate_positive_contract_only" && model.modelKey ? `stick_vacuum|${model.modelKey}|complete_set` : null,
    familyGroup: model.familyGroup,
    titleExactModelVisible: model.titleExactModelVisible,
    completeSetSignal: setSignal,
    componentEvidence: components,
    holdClass,
    robotLaneHold: robot,
    reason,
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  };
}

function buildMarkdown(report: Record<string, unknown>, rows: AcquisitionRow[]): string {
  const metrics = report.metrics as Record<string, number | boolean>;
  const boundary = report.boundary as Record<string, boolean | number>;
  const positives = rows.filter((row) => row.decision === "candidate_positive_contract_only");
  const manual = rows.filter((row) => row.decision === "manual_hold");
  const hold = rows.filter((row) => row.decision === "negative_hold");

  const lines = [
    "# Home Appliance Stick Vacuum Targeted Acquisition Wave 2",
    "",
    `- generatedAt: ${report.generatedAt}`,
    "- category: home_appliance_tech_discovered",
    "- lane: home_appliance_stick_vacuum_targeted_acquisition_wave2",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Boundary",
    "",
    `- reportOnly: ${boundary.reportOnly}`,
    `- runtimeApproved: ${boundary.runtimeApproved}`,
    `- runtimeApprovedRows: ${boundary.runtimeApprovedRows}`,
    `- runtimeApply: ${boundary.runtimeApply}`,
    `- runtimeApplyRows: ${boundary.runtimeApplyRows}`,
    `- publicPromotion: ${boundary.publicPromotion}`,
    `- publicPromotionRows: ${boundary.publicPromotionRows}`,
    `- candidatePool: ${boundary.candidatePool}`,
    `- candidatePoolRows: ${boundary.candidatePoolRows}`,
    `- runtimeCatalogApply: ${boundary.runtimeCatalogApply}`,
    `- candidatePoolPolicyWiring: ${boundary.candidatePoolPolicyWiring}`,
    `- productionDbMutation: ${boundary.productionDbMutation}`,
    `- directThirtyDayPlanEdit: ${boundary.directThirtyDayPlanEdit}`,
    "",
    "## Network Calls",
    "",
    "- allowedSurface: Bunjang public API reads only",
    "- openAiCalls: 0",
    "- supabaseCalls: 0",
    `- queryCount: ${(report.networkCalls as { queryCount: number }).queryCount}`,
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
    `- candidatePoolRows: ${metrics.candidatePoolRows}`,
    `- runtimeApplyRows: ${metrics.runtimeApplyRows}`,
    `- strictGoalMet: ${metrics.strictGoalMet}`,
    "",
    "## Strict Positive Rule Used",
    "",
    "A positive wave2 row requires title-visible exact model evidence, title or description complete-set evidence, and main unit, charger, and main head/tool evidence. Robot vacuum, wet-dry/mop, bedding cleaner, accessory/consumable, missing exact model, incomplete set, and condition/battery caveat rows remain manual/hold.",
    "",
    "## Positive Candidates",
    "",
    "| caseId | familyGroup | modelKey | comparableKey | componentEvidence | title | query |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...positives.map((row) =>
      `| ${row.caseId} | ${markdownEscape(row.familyGroup)} | ${markdownEscape(row.modelKey)} | ${markdownEscape(row.comparableKey)} | ${row.componentEvidence.join(", ")} | ${markdownEscape(row.title)} | ${markdownEscape(row.query)} |`,
    ),
    "",
    "## Manual Holds",
    "",
    "| caseId | holdClass | modelKey | completeSetSignal | componentEvidence | title |",
    "| --- | --- | --- | --- | --- | --- |",
    ...manual.map((row) =>
      `| ${row.caseId} | ${markdownEscape(row.holdClass)} | ${markdownEscape(row.modelKey)} | ${row.completeSetSignal} | ${row.componentEvidence.join(", ")} | ${markdownEscape(row.title)} |`,
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
    "- Continue non-Dyson targeted acquisition around LG CodeZero A9/A9S, Samsung Bespoke Jet, Dreame/Xiaomi/Roborock handstick, and other non-robot handstick complete-set rows.",
    "- Keep stand/dock optional only after body, charger, and main head/tool evidence are already visible; leave the final owner decision open.",
    "- Keep robot vacuum, bedding cleaner, wet-dry/mop, accessory/consumable, missing exact model, incomplete set, and condition/battery caveat rows out of positives.",
    "- Do not wire runtime, public promotion, candidate pool, Supabase, cron, lifecycle, pack UI, catalog, or 30-day-plan changes from this report.",
    "",
    "## Deferred Owner Decisions",
    "",
    "- LG CodeZero A9/A9S exact-model semantics still need owner approval before runtime use.",
    "- Samsung Bespoke Jet wattage/generation variants still need comparable-key granularity review before runtime use.",
    "- Dreame/Roborock/Xiaomi family grouping remains report-only until enough strict positives and hold coverage are reviewed together.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const inputs = await readRequiredInputs();
  const seen = new Map<string, BunjangSearchItem>();

  for (const query of queries) {
    for (const page of [0, 1, 2]) {
      const items = await searchPage(query, page, 10);
      for (const item of items) {
        const title = normalizeText(item.name);
        if (/(?:다이슨|dyson).{0,12}v1[01]|v1[01].{0,12}(?:다이슨|dyson)/.test(title)) continue;
        if (!seen.has(item.pid)) seen.set(item.pid, item);
      }
      await sleep(80);
    }
    await sleep(80);
  }

  const targetedItems = [...seen.values()].slice(0, 90);
  const rows: AcquisitionRow[] = [];
  for (const item of targetedItems) {
    const detail = await fetchDetail(item.pid);
    rows.push(classify(item, detail, rows.length));
    await sleep(80);
  }

  const positiveRows = rows.filter((row) => row.decision === "candidate_positive_contract_only");
  const manualRows = rows.filter((row) => row.decision === "manual_hold");
  const negativeRows = rows.filter((row) => row.decision === "negative_hold");
  const positiveFamilyGroups = new Set(positiveRows.map((row) => row.familyGroup).filter(Boolean)).size;
  const zeroBoundary = {
    reportOnly: true,
    runtimeApproved: false,
    runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
    runtimeApply: false,
    runtimeApplyRows: rows.filter((row) => row.runtimeApply).length,
    publicPromotion: false,
    publicPromotionRows: rows.filter((row) => row.publicPromotion).length,
    candidatePool: false,
    candidatePoolRows: rows.filter((row) => row.candidatePool).length,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
  };
  const metrics = {
    queriedRows: targetedItems.length,
    reviewedRows: rows.length,
    candidatePositiveContractOnlyRows: positiveRows.length,
    manualHoldRows: manualRows.length,
    negativeHoldRows: negativeRows.length,
    positiveFamilyGroups,
    positiveModelKeys: new Set(positiveRows.map((row) => row.modelKey).filter(Boolean)).size,
    robotLaneHoldRows: rows.filter((row) => row.robotLaneHold).length,
    runtimeApprovedRows: zeroBoundary.runtimeApprovedRows,
    publicPromotionRows: zeroBoundary.publicPromotionRows,
    candidatePoolRows: zeroBoundary.candidatePoolRows,
    runtimeApplyRows: zeroBoundary.runtimeApplyRows,
    strictGoalMet: positiveRows.length >= 8 && positiveFamilyGroups >= 3,
  };

  const report = {
    generatedAt,
    reportOnly: true,
    runtimeApproved: false,
    runtimeApply: false,
    runtimeCatalogApply: false,
    publicPromotion: false,
    candidatePool: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "home_appliance_tech_discovered",
    lane: "home_appliance_stick_vacuum_targeted_acquisition_wave2",
    inputFiles,
    inputReadSummary: inputs,
    boundary: zeroBoundary,
    networkCalls: {
      allowedSurface: "Bunjang public API reads only",
      openAiCalls: 0,
      supabaseCalls: 0,
      queryCount: queries.length,
      queries,
    },
    strictPositiveRule:
      "title-visible exact model + title/description complete-set evidence + main unit, charger, and main head/tool; robot vacuum, wet-dry/mop, bedding cleaner, accessory/consumable, missing exact model, incomplete set, and condition/battery caveat rows hold/manual",
    metrics,
    rows,
    acquisitionPlan: [
      "Continue non-Dyson exact-model plus complete-set targeted queries.",
      "Prioritize LG CodeZero A9/A9S, Samsung Bespoke Jet, Dreame/Xiaomi/Roborock handstick, and other non-robot handstick complete-set rows.",
      "Keep every row report-only with runtimeApproved/publicPromotion/candidatePool/runtimeApply false.",
      "No runtime, public promotion, candidate pool, Supabase, cron, lifecycle, pack UI, catalog, or 30-day-plan mutation from this packet.",
    ],
    conclusion: metrics.strictGoalMet
      ? "wave2_non_dyson_positive_goal_met_report_only_no_runtime_approval"
      : "wave2_non_dyson_positive_goal_not_met_report_only_continue_acquisition",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(outputMdPath, buildMarkdown(report, rows));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
