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

function bodyModel(row: { title: string; description: string }) {
  const text = `${row.title}\n${row.description}`.toLowerCase().replace(/\s+/g, "");
  if (/a7m3|a7iii|ilce-7m3|ilce7m3/.test(text)) return "sony-a7m3";
  if (/eosr6/.test(text)) return "canon-eos-r6";
  if (/z6ii|z6-ii/.test(text)) return "nikon-z6ii";
  return "unknown";
}

function strictHoldReasons(row: { title: string; description: string; saleStatus: string }) {
  const text = `${row.title}\n${row.description}`.toLowerCase();
  const title = row.title.toLowerCase();
  const reasons = [
    row.saleStatus.trim().toUpperCase() !== "SELLING" ? "not_selling" : null,
    /판매\s*완료|거래\s*완료|예약\s*완료|\bsold\b|sold\s*out|팔렸/.test(text) ? "sold_text" : null,
    /삽니다|구매합니다|매입|구해요|구함|구합니다/.test(text) ? "buying_text" : null,
    /고장|파손|부품용|수리|작동안|불량|침수/.test(text) ? "damaged_or_part_text" : null,
    /렌즈만|렌즈\s*단품|렌즈팝니다|바디캡|케이지|가방|케이스만|스트랩만|충전기만|배터리만/.test(title) ? "accessory_or_lens_only_title" : null,
    /렌즈|번들|패키지|세트/.test(text) && !/바디|body|본체/.test(text) ? "lens_or_package_without_body_signal" : null,
    !/바디|body|본체/.test(text) ? "body_only_context_missing" : null,
  ].filter((reason): reason is string => Boolean(reason));
  return reasons;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const source = JSON.parse(await readFile(sourcePath, "utf-8")) as SourceReport;
  const lane = source.lanes.find((row) => row.lane === "camera_body_only_exact_model");
  if (!lane) throw new Error("camera_body_only_exact_model lane missing");

  const evaluatedRows = lane.rows.map((row) => {
    const model = bodyModel(row);
    const strictReasons = strictHoldReasons(row);
    const strictPass = row.disposition === "fresh_live_candidate" && model !== "unknown" && strictReasons.length === 0;
    return {
      ...row,
      model,
      strictReasons,
      strictPass,
    };
  });
  const allowedRows = evaluatedRows.filter((row) => row.strictPass && row.model === "sony-a7m3");
  const excludedRows = evaluatedRows.filter((row) => !row.strictPass || row.model !== "sony-a7m3").map((row) => ({
    pid: row.pid,
    title: row.title,
    model: row.model,
    disposition: row.disposition,
    reason: row.strictReasons.join(", ") || row.reason,
  }));

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    category: "camera_discovered",
    sourceReport: "reports/category-no-write-live-read-observation-latest.json",
    lane: "camera_body_only_exact_model_strict_contract",
    metrics: {
      sourceRows: lane.rows.length,
      strictAllowedRows: allowedRows.length,
      excludedRows: excludedRows.length,
      maxFutureWriteCap: Math.min(allowedRows.length, 2),
      candidatePoolWrites: 0,
      rawWrites: 0,
      parsedWrites: 0,
      publicPromotionRows: 0,
    },
    firstLaneModelCode: "sony-a7m3",
    deferredModelCodes: ["canon-eos-r6", "nikon-z6ii", "sony-a7m4", "sony-a7m2"],
    requiredGateBeforeAnyFutureWrite: [
      "fresh_detail_refetch_within_same_request",
      "sale_status_selling",
      "exact_model_code_sony_a7m3",
      "body_only_context_present",
      "no_sold_reserved_completed_text",
      "no_buying_text",
      "no_damaged_or_part_text",
      "no_lens_or_accessory_only_title",
      "no_lens_package_without_body_signal",
      "same_model_code_after_detail",
      "max_write_cap_2_rows",
      "no_public_promotion",
    ],
    allowedRows,
    excludedRows,
    conclusion: allowedRows.length >= 2
      ? "camera_sony_a7m3_body_only_contract_ready_for_owner_review_but_thin"
      : "camera_body_only_contract_needs_more_rows",
    nextStep:
      "Keep as thin no-write evidence; gather a second camera live-read wave before any future write-cap review.",
  };

  const jsonPath = path.join(reportsDir, "camera-body-only-strict-contract-latest.json");
  const mdPath = path.join(reportsDir, "camera-body-only-strict-contract-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Camera Body-Only Strict Contract",
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
    `- excludedRows: ${report.metrics.excludedRows}`,
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
