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

function modelCode(row: { title: string; description: string }) {
  const text = `${row.title}\n${row.description}`.toLowerCase();
  if (/xl\s*2540\s*k|xl2540k/i.test(text)) return "benq-zowie-xl2540k";
  if (/aw\s*2525\s*hm|aw2525hm/i.test(text)) return "alienware-aw2525hm";
  return "unknown";
}

function strictHoldReasons(row: { title: string; description: string; saleStatus: string }) {
  const text = `${row.title}\n${row.description}`.toLowerCase();
  const title = row.title.toLowerCase();
  const reasons = [
    row.saleStatus.trim().toUpperCase() !== "SELLING" ? "not_selling" : null,
    /판매\s*완료|거래\s*완료|예약\s*완료|\bsold\b|sold\s*out|팔렸/.test(text) ? "sold_text" : null,
    /삽니다|구매합니다|매입|구해요|구함|구합니다/.test(text) ? "buying_text" : null,
    /고장|파손|부품용|수리|패널만|화면깨|액정깨|작동안|불량/.test(text) ? "damaged_or_part_text" : null,
    /모니터암만|암만|스탠드만|거치대만|어댑터만|케이블만|부품만/.test(title) ? "accessory_only_title" : null,
    !/모니터|monitor|게이밍|hz|주사율|인치/.test(text) ? "monitor_context_missing" : null,
  ].filter((reason): reason is string => Boolean(reason));
  return reasons;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const source = JSON.parse(await readFile(sourcePath, "utf-8")) as SourceReport;
  const lane = source.lanes.find((row) => row.lane === "monitor_selected_exact_model");
  if (!lane) throw new Error("monitor_selected_exact_model lane missing");

  const evaluatedRows = lane.rows.map((row) => {
    const code = modelCode(row);
    const strictReasons = strictHoldReasons(row);
    const accessoryFalseHoldRecovery =
      row.disposition === "hold" &&
      row.reason === "monitor_accessory_or_part_signal" &&
      code !== "unknown" &&
      strictReasons.length === 0;
    const strictPass =
      (row.disposition === "fresh_live_candidate" || accessoryFalseHoldRecovery) &&
      code !== "unknown" &&
      strictReasons.length === 0;
    return {
      ...row,
      modelCode: code,
      strictReasons,
      accessoryFalseHoldRecovery,
      strictPass,
    };
  });
  const allowedRows = evaluatedRows.filter((row) => row.strictPass && row.modelCode === "benq-zowie-xl2540k");
  const optionalRows = evaluatedRows.filter((row) => row.strictPass && row.modelCode === "alienware-aw2525hm");
  const excludedRows = evaluatedRows.filter((row) => !row.strictPass || row.modelCode !== "benq-zowie-xl2540k").map((row) => ({
    pid: row.pid,
    title: row.title,
    modelCode: row.modelCode,
    disposition: row.disposition,
    reason: row.modelCode === "alienware-aw2525hm" && row.strictPass
      ? "optional_second_monitor_lane_singleton"
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
    category: "monitor_discovered",
    sourceReport: "reports/category-no-write-live-read-observation-latest.json",
    lane: "monitor_selected_exact_model_strict_contract",
    metrics: {
      sourceRows: lane.rows.length,
      strictAllowedRows: allowedRows.length,
      optionalRows: optionalRows.length,
      excludedRows: excludedRows.length,
      maxFutureWriteCap: Math.min(allowedRows.length, 5),
      candidatePoolWrites: 0,
      rawWrites: 0,
      parsedWrites: 0,
      publicPromotionRows: 0,
    },
    firstLaneModelCode: "benq-zowie-xl2540k",
    optionalLaterModelCodes: ["alienware-aw2525hm"],
    deferredModelCodes: ["lg-27us550", "dell-u2412mb", "generic-monitor-no-model-code"],
    requiredGateBeforeAnyFutureWrite: [
      "fresh_detail_refetch_within_same_request",
      "sale_status_selling",
      "exact_model_code_xl2540k",
      "monitor_context_present",
      "no_sold_reserved_completed_text",
      "no_buying_text",
      "no_damaged_or_part_text",
      "no_accessory_only_title",
      "same_model_code_after_detail",
      "accessory_terms_allowed_only_when_bundled_extras_not_only_item",
      "max_write_cap_5_rows",
      "no_public_promotion",
    ],
    allowedRows,
    optionalRows,
    excludedRows,
    conclusion: allowedRows.length >= 4
      ? "monitor_xl2540k_strict_write_cap_contract_ready_for_owner_review"
      : "monitor_xl2540k_contract_needs_more_rows",
    nextStep:
      "Keep as no-write evidence; if later approved, use only XL2540K with fresh detail refetch and max write cap 5.",
  };

  const jsonPath = path.join(reportsDir, "monitor-selected-exact-model-strict-contract-latest.json");
  const mdPath = path.join(reportsDir, "monitor-selected-exact-model-strict-contract-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Monitor Selected Exact Model Strict Contract",
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
    `- maxFutureWriteCap: ${report.metrics.maxFutureWriteCap}`,
    `- accessoryFalseHoldRecoveryRows: ${allowedRows.filter((row) => row.accessoryFalseHoldRecovery).length}`,
    "",
    "## First Lane",
    "",
    `- ${report.firstLaneModelCode}`,
    "",
    "## Optional Later Model Codes",
    "",
    ...report.optionalLaterModelCodes.map((code) => `- ${code}`),
    "",
    "## Required Gate Before Any Future Write",
    "",
    ...report.requiredGateBeforeAnyFutureWrite.map((gate) => `- ${gate}`),
    "",
    "## Allowed Rows",
    "",
    mdTable(
      ["pid", "title", "price", "modelCode", "saleStatus"],
      allowedRows.map((row) => [row.pid, compact(row.title), row.price, row.modelCode, row.saleStatus]),
    ),
    "",
    "## Optional Rows",
    "",
    mdTable(
      ["pid", "title", "price", "modelCode", "saleStatus"],
      optionalRows.map((row) => [row.pid, compact(row.title), row.price, row.modelCode, row.saleStatus]),
    ),
    "",
    "## Excluded Rows",
    "",
    mdTable(
      ["pid", "title", "modelCode", "disposition", "reason"],
      excludedRows.map((row) => [row.pid, compact(row.title), row.modelCode, row.disposition, row.reason]),
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
