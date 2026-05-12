import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");
const sourcePath = path.join(reportsDir, "headphone-first-wave-fresh-detail-rehearsal-latest.json");

type FreshDetailReport = {
  passingRows: Array<{
    pid: number;
    title: string;
    price: number;
    skuId: string | null;
    comparableKey: string | null;
    saleStatus: string | null;
  }>;
  failingRows: Array<{
    pid: number;
    title: string;
    skuId: string | null;
    failReasons: string[];
  }>;
};

function compact(text: unknown, limit = 88) {
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

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const source = JSON.parse(await readFile(sourcePath, "utf-8")) as FreshDetailReport;
  const allowedRows = source.passingRows.filter((row) =>
    row.skuId === "sony-wh-1000xm4" || row.skuId === "sony-wh-ch520",
  );
  const excludedRows = [
    ...source.passingRows.filter((row) => row.skuId !== "sony-wh-1000xm4" && row.skuId !== "sony-wh-ch520").map((row) => ({
      pid: row.pid,
      title: row.title,
      skuId: row.skuId,
      reason: "not_in_first_strict_sony_lane",
    })),
    ...source.failingRows.map((row) => ({
      pid: row.pid,
      title: row.title,
      skuId: row.skuId,
      reason: row.failReasons.join(", "),
    })),
  ];

  const contract = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    sourceReport: "reports/headphone-first-wave-fresh-detail-rehearsal-latest.json",
    lane: "non_airpods_headphone_first_wave_strict_write_cap_contract",
    metrics: {
      sourcePassingRows: source.passingRows.length,
      allowedRows: allowedRows.length,
      allowedSkus: Object.keys(countBy(allowedRows, (row) => row.skuId ?? "unknown")).length,
      excludedRows: excludedRows.length,
      maxFutureWriteCap: Math.min(allowedRows.length, 7),
      candidatePoolWrites: 0,
      rawWrites: 0,
      parsedWrites: 0,
      publicPromotionRows: 0,
    },
    allowedSkus: ["sony-wh-1000xm4", "sony-wh-ch520"],
    explicitlyDeferredSkus: [
      "bose-qc45",
      "sony-wh-ult900n",
      "sony-wh-1000xm5",
      "sony-wh-1000xm3",
      "sony-wh-1000xm6",
      "sony-wh-ch720n",
      "bose-qc-ultra",
      "sennheiser-accentum",
      "sennheiser-hd569",
      "beats-solo4",
    ],
    requiredGateBeforeAnyFutureWrite: [
      "fresh_detail_refetch_within_same_request",
      "sale_status_selling",
      "same_sku_id_as_contract",
      "same_comparable_key_as_contract",
      "runtime_listing_type_normal",
      "runtime_needs_review_false",
      "no_sold_reserved_completed_text",
      "no_buying_or_trade_text",
      "no_damaged_or_parts_text",
      "no_accessory_only_text",
      "no_not_full_headphone_text",
      "no_counterfeit_or_compatible_text",
      "max_write_cap_7_rows",
      "no_public_promotion",
    ],
    allowedRows,
    excludedRows,
    conclusion: allowedRows.length >= 6
      ? "headphone_first_wave_strict_write_cap_contract_ready_for_owner_review"
      : "headphone_first_wave_strict_write_cap_contract_needs_more_rows",
    nextStep:
      "Owner/main-agent may review this contract later, but it must not be executed while runtime/Supabase P0 work is active.",
  };

  const jsonPath = path.join(reportsDir, "headphone-first-wave-strict-write-cap-contract-latest.json");
  const mdPath = path.join(reportsDir, "headphone-first-wave-strict-write-cap-contract-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(contract, null, 2)}\n`);

  const md = [
    "# Headphone First-Wave Strict Write-Cap Contract",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- conclusion: ${contract.conclusion}`,
    "",
    "## Metrics",
    "",
    `- sourcePassingRows: ${contract.metrics.sourcePassingRows}`,
    `- allowedRows: ${contract.metrics.allowedRows}`,
    `- allowedSkus: ${contract.metrics.allowedSkus}`,
    `- excludedRows: ${contract.metrics.excludedRows}`,
    `- maxFutureWriteCap: ${contract.metrics.maxFutureWriteCap}`,
    "",
    "## Allowed SKUs",
    "",
    ...contract.allowedSkus.map((sku) => `- ${sku}`),
    "",
    "## Explicitly Deferred SKUs",
    "",
    ...contract.explicitlyDeferredSkus.map((sku) => `- ${sku}`),
    "",
    "## Required Gate Before Any Future Write",
    "",
    ...contract.requiredGateBeforeAnyFutureWrite.map((gate) => `- ${gate}`),
    "",
    "## Allowed Rows",
    "",
    mdTable(
      ["pid", "title", "price", "sku", "key", "saleStatus"],
      allowedRows.map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.skuId ?? "",
        row.comparableKey ?? "",
        row.saleStatus ?? "",
      ]),
    ),
    "",
    "## Excluded Rows",
    "",
    mdTable(
      ["pid", "title", "sku", "reason"],
      excludedRows.map((row) => [row.pid, compact(row.title), row.skuId ?? "", row.reason]),
    ),
    "",
    "## Next Step",
    "",
    `- ${contract.nextStep}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(
    JSON.stringify(
      {
        conclusion: contract.conclusion,
        allowedRows: contract.metrics.allowedRows,
        maxFutureWriteCap: contract.metrics.maxFutureWriteCap,
        jsonPath,
        mdPath,
      },
      null,
      2,
    ),
  );
}

void main();
