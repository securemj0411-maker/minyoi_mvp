import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");
const sourcePath = path.join(reportsDir, "category-no-write-live-read-observation-latest.json");

type SourceReport = {
  lanes: Array<{
    lane: string;
    rows: Array<{
      pid: string;
      title: string;
      price: number;
      saleStatus: string;
      description: string;
      disposition: string;
      reason: string;
      matchedSignals: string[];
      holdSignals: string[];
    }>;
  }>;
};

function compact(text: unknown, limit = 92) {
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

function speakerModel(row: { title: string; description: string }) {
  const text = `${row.title}\n${row.description}`.toLowerCase().replace(/\s+/g, "");
  if (/jbl.*flip6|flip6|플립6/.test(text)) return "jbl-flip-6";
  if (/soundlinkmini|사운드링크미니|보스.*미니/.test(text)) return "bose-soundlink-mini";
  if (/emberton|엠버튼/.test(text)) return "marshall-emberton";
  return "unknown";
}

function strictHoldReasons(row: { title: string; description: string; saleStatus: string }) {
  const text = `${row.title}\n${row.description}`.toLowerCase();
  const title = row.title.toLowerCase();
  const reasons = [
    row.saleStatus.trim().toUpperCase() !== "SELLING" ? "not_selling" : null,
    /판매\s*완료|거래\s*완료|예약\s*완료|\bsold\b|sold\s*out|팔렸/.test(text) ? "sold_text" : null,
    /삽니다|구매합니다|매입|구해요|구함|구합니다/.test(text) ? "buying_text" : null,
    /대여|렌탈|임대|하루대여|단기렌탈/.test(text) ? "rental_text" : null,
    /고장|파손|부품용|수리|작동안|불량|충전단자만/.test(text) ? "damaged_or_part_text" : null,
    /케이스만|파우치만|거치대만|충전기만|케이블만|부품만|배터리만/.test(title) ||
    ((/케이스|파우치|거치대|충전기|케이블|부품|배터리/.test(title)) && !/스피커|speaker|블루투스/.test(title))
      ? "accessory_only_title"
      : null,
    !/스피커|speaker|블루투스|음질|소리/.test(text) ? "speaker_context_missing" : null,
  ].filter((reason): reason is string => Boolean(reason));
  return reasons;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const source = JSON.parse(await readFile(sourcePath, "utf-8")) as SourceReport;
  const lane = source.lanes.find((row) => row.lane === "speaker_selected_subset");
  if (!lane) throw new Error("speaker_selected_subset lane missing");

  const evaluatedRows = lane.rows.map((row) => {
    const model = speakerModel(row);
    const strictReasons = strictHoldReasons(row);
    const contextFalseManualRecovery =
      row.disposition === "manual_review" &&
      row.reason === "exact_model_but_speaker_context_missing" &&
      model === "jbl-flip-6" &&
      strictReasons.length === 0;
    const strictPass =
      (row.disposition === "fresh_live_candidate" || contextFalseManualRecovery) &&
      model !== "unknown" &&
      strictReasons.length === 0;
    return {
      ...row,
      model,
      strictReasons,
      contextFalseManualRecovery,
      strictPass,
    };
  });
  const allowedRows = evaluatedRows.filter((row) => row.strictPass && row.model === "jbl-flip-6");
  const optionalRows = evaluatedRows.filter((row) => row.strictPass && row.model !== "jbl-flip-6");
  const excludedRows = evaluatedRows.filter((row) => !row.strictPass || row.model !== "jbl-flip-6").map((row) => ({
    pid: row.pid,
    title: row.title,
    model: row.model,
    disposition: row.disposition,
    reason: row.model !== "jbl-flip-6" && row.strictPass
      ? "optional_second_speaker_lane"
      : row.strictReasons.join(", ") || row.reason,
  }));

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    category: "speaker_audio_discovered",
    sourceReport: "reports/category-no-write-live-read-observation-latest.json",
    lane: "speaker_selected_subset_strict_contract",
    metrics: {
      sourceRows: lane.rows.length,
      strictAllowedRows: allowedRows.length,
      optionalRows: optionalRows.length,
      excludedRows: excludedRows.length,
      falseManualRecoveryRows: allowedRows.filter((row) => row.contextFalseManualRecovery).length,
      maxFutureWriteCap: Math.min(allowedRows.length, 4),
      candidatePoolWrites: 0,
      rawWrites: 0,
      parsedWrites: 0,
      publicPromotionRows: 0,
    },
    firstLaneModelCode: "jbl-flip-6",
    optionalLaterModelCodes: ["bose-soundlink-mini", "marshall-emberton"],
    requiredGateBeforeAnyFutureWrite: [
      "fresh_detail_refetch_within_same_request",
      "sale_status_selling",
      "exact_model_code_jbl_flip_6",
      "speaker_context_present",
      "no_sold_reserved_completed_text",
      "no_buying_text",
      "no_rental_text",
      "no_damaged_or_part_text",
      "no_accessory_only_title",
      "same_model_code_after_detail",
      "max_write_cap_3_rows",
      "no_public_promotion",
    ],
    allowedRows,
    optionalRows,
    excludedRows,
    conclusion: allowedRows.length >= 3
      ? "speaker_jbl_flip6_strict_write_cap_contract_ready_for_owner_review"
      : "speaker_jbl_flip6_contract_needs_more_rows",
    nextStep:
      "Keep as no-write evidence; if later approved, use only JBL Flip 6 with fresh detail refetch and max write cap 3.",
  };

  const jsonPath = path.join(reportsDir, "speaker-selected-subset-strict-contract-latest.json");
  const mdPath = path.join(reportsDir, "speaker-selected-subset-strict-contract-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Speaker Selected Subset Strict Contract",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Metrics",
    "",
    `- sourceRows: ${report.metrics.sourceRows}`,
    `- strictAllowedRows: ${report.metrics.strictAllowedRows}`,
    `- optionalRows: ${report.metrics.optionalRows}`,
    `- excludedRows: ${report.metrics.excludedRows}`,
    `- falseManualRecoveryRows: ${report.metrics.falseManualRecoveryRows}`,
    `- maxFutureWriteCap: ${report.metrics.maxFutureWriteCap}`,
    "",
    "## First Lane",
    "",
    `- ${report.firstLaneModelCode}`,
    "",
    "## Required Gate Before Any Future Write",
    "",
    ...report.requiredGateBeforeAnyFutureWrite.map((gate) => `- ${gate}`),
    "",
    "## Allowed Rows",
    "",
    mdTable(
      ["pid", "title", "price", "model", "saleStatus"],
      allowedRows.map((row) => [row.pid, compact(row.title), row.price, row.model, row.saleStatus]),
    ),
    "",
    "## Excluded Rows",
    "",
    mdTable(
      ["pid", "title", "model", "disposition", "reason"],
      excludedRows.map((row) => [row.pid, compact(row.title), row.model, row.disposition, row.reason]),
    ),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    conclusion: report.conclusion,
    strictAllowedRows: report.metrics.strictAllowedRows,
    maxFutureWriteCap: report.metrics.maxFutureWriteCap,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
